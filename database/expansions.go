package main

import (
	"database/sql"
	"encoding/json"
	"errors"

	"coffe-mania/database/playerstate"
	"coffe-mania/shared/roomcatalog"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Café expansions, as documented in docs/expansoes.md. The café starts with a 6x9 floor and each
// step is bought on a card of the "Expansões" tab of the shop: the room keeps its walls at row
// and column 0 and gains rows and columns at the far edges, so placed pieces never move.
//
// Sources: the expansion tab of a level 3 café lists 7x9, 8x10 and 10x11 in pairs, the 7x9 in
// caféGranas "Disponível" for 5 and the other card of each size "Não disponível"; the shop of the
// second floor (2014) shows the same sizes. The "Comprar Expansão?" window (2010) offers 40000
// caféOuros or 10 caféGranas; the "Bloqueado!" window asks for level 15 and unlocks for
// 10 caféGranas. Paying in caféGranas never had a level or neighbor requirement ("Nem precisa
// se preocupar com nível de experiência ou quantidade de vizinhos", 2011). The other prices,
// levels and the steps after 10x11 are project values: no source lists them.
var expansionSteps = []expansionStep{
	{FloorX: 7, FloorY: 9, Level: 15, PriceCash: 5, PriceGold: 40000, UnlockCash: 10},
	{FloorX: 8, FloorY: 10, Level: 20, PriceCash: 10, PriceGold: 80000, UnlockCash: 15},
	{FloorX: 10, FloorY: 11, Level: 25, PriceCash: 20, PriceGold: 150000, UnlockCash: 20},
	{FloorX: 11, FloorY: 13, Level: 32, PriceCash: 30, PriceGold: 250000, UnlockCash: 25},
	{FloorX: 13, FloorY: 14, Level: 40, PriceCash: 45, PriceGold: 400000, UnlockCash: 30},
}

// Floor of a new café, before any expansion (row and column 0 hold the walls).
const starterFloorX, starterFloorY = 6, 9

// Starter shell pieces, the same ones ensureRoom places in a new café.
const (
	starterFloorItemID     = 3050000
	starterWallpaperItemID = 3060016
	roomWallItemID         = 3090000
	roomWallCornerItemID   = 3090001
)

var errExpansionLevel = errors.New("Seu nível ainda não libera esta expansão. Destrave antes ou pague em caféGranas.")
var errExpansionMax = errors.New("O café já está no tamanho máximo.")
var errExpansionCash = errors.New("caféGranas insuficientes.")
var errExpansionPayment = errors.New("Forma de pagamento inválida.")

type expansionStep struct {
	FloorX     int   `json:"floorX"`
	FloorY     int   `json:"floorY"`
	Level      int   `json:"level"`
	PriceCash  int64 `json:"priceCash"`
	PriceGold  int64 `json:"priceGold"`
	UnlockCash int64 `json:"unlockCash"`
}

// expansionOffer is the next block for sale; nil once the café reached its maximum size.
type expansionOffer struct {
	expansionStep
	Step  int `json:"step"`
	Steps int `json:"steps"`
}

// nextExpansion returns the first step whose floor the room does not cover yet. Rooms resized
// in another way skip the steps they already contain.
func nextExpansion(tilesX, tilesY int) (expansionStep, int, bool) {
	for index, step := range expansionSteps {
		if step.FloorX+1 > tilesX || step.FloorY+1 > tilesY {
			return step, index + 1, true
		}
	}
	return expansionStep{}, 0, false
}

func expansionFor(tilesX, tilesY int) *expansionOffer {
	step, index, ok := nextExpansion(tilesX, tilesY)
	if !ok {
		return nil
	}
	return &expansionOffer{expansionStep: step, Step: index, Steps: len(expansionSteps)}
}

// mutateExpansion pays for the next block and grows the room in one transaction. Payment is
// "cash" (caféGranas, no requirement), "gold" (caféOuros, needs the level) or "gold_unlock"
// (caféOuros plus the unlock price in caféGranas, which waives the level). The revision check
// and the request key follow mutateRoom, so a retried request never charges twice.
func mutateExpansion(app core.App, userID string, command roomCommand) (roomSnapshot, error) {
	var result roomSnapshot
	payloadBytes, _ := json.Marshal(struct {
		Action  string
		Command roomCommand
	}{"expand", command})
	payload := string(payloadBytes)
	err := app.RunInTransaction(func(tx core.App) error {
		operation, err := tx.FindFirstRecordByFilter("room_operations", "user={:user} && request_key={:key}", dbx.Params{"user": userID, "key": command.RequestID})
		if err == nil {
			if operation.GetString("payload") != payload {
				return errRoomOperation
			}
			result, err = snapshotRoom(tx, userID)
			return err
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		room, err := tx.FindFirstRecordByData("player_rooms", "user", userID)
		if err != nil {
			return err
		}
		if command.Revision == nil || room.GetInt("revision") != *command.Revision {
			return errRoomConflict
		}
		step, _, ok := nextExpansion(room.GetInt("tiles_x"), room.GetInt("tiles_y"))
		if !ok {
			return errExpansionMax
		}
		state, err := tx.FindFirstRecordByData(playerstate.Collection, "user", userID)
		if err != nil {
			return err
		}
		var cash, gold int64
		switch command.Payment {
		case "cash":
			cash = step.PriceCash
		case "gold":
			if state.GetInt("level") < step.Level {
				return errExpansionLevel
			}
			gold = step.PriceGold
		case "gold_unlock":
			cash, gold = step.UnlockCash, step.PriceGold
		default:
			return errExpansionPayment
		}
		if state.GetInt64("cash") < cash {
			return errExpansionCash
		}
		if state.GetInt64("gold") < gold {
			return errRoomGold
		}
		state.Set("cash", state.GetInt64("cash")-cash)
		state.Set("gold", state.GetInt64("gold")-gold)
		if err := tx.Save(state); err != nil {
			return err
		}
		room.Set("tiles_x", max(room.GetInt("tiles_x"), step.FloorX+1))
		room.Set("tiles_y", max(room.GetInt("tiles_y"), step.FloorY+1))
		if _, err := fillRoomShell(tx, userID, room.GetInt("tiles_x"), room.GetInt("tiles_y")); err != nil {
			return err
		}
		room.Set("revision", room.GetInt("revision")+1)
		if err := tx.Save(room); err != nil {
			return err
		}
		operations, err := tx.FindCollectionByNameOrId("room_operations")
		if err != nil {
			return err
		}
		saved := core.NewRecord(operations)
		saved.Load(map[string]any{"user": userID, "request_key": command.RequestID, "payload": payload})
		if err := tx.Save(saved); err != nil {
			return err
		}
		result, err = snapshotRoom(tx, userID)
		return err
	})
	return result, err
}

// fillRoomShell places the starter wall, wallpaper and floor on every tile of the room that
// lacks them: the new block of an expansion, and rooms expanded before the shell was filled.
// New wall segments continue the wallpaper of the segment before them on the same wall.
// It reports whether anything was added.
func fillRoomShell(tx core.App, userID string, tilesX, tilesY int) (bool, error) {
	units, err := tx.FindRecordsByFilter("player_inventory", "user={:user} && placed=true && (layer='structure' || layer='wallpaper' || layer='floor')", "", 0, 0, dbx.Params{"user": userID})
	if err != nil {
		return false, err
	}
	type tile struct{ x, y int }
	walls, floors := map[tile]bool{}, map[tile]bool{}
	papers := map[tile]int{}
	for _, unit := range units {
		at := tile{unit.GetInt("tx"), unit.GetInt("ty")}
		switch unit.GetString("layer") {
		case "structure":
			walls[at] = true
		case "wallpaper":
			papers[at] = unit.GetInt("item_id")
		case "floor":
			floors[at] = true
		}
	}
	inventory, err := tx.FindCollectionByNameOrId("player_inventory")
	if err != nil {
		return false, err
	}
	added := false
	add := func(id, x, y, rotation int) error {
		item, ok := roomcatalog.ByID(id)
		if !ok {
			return errors.New("room shell item missing")
		}
		unit := core.NewRecord(inventory)
		unit.Load(map[string]any{"user": userID, "item_id": id, "tx": x, "ty": y, "rotation": rotation, "placed": true, "layer": roomcatalog.Layer(item)})
		added = true
		return tx.Save(unit)
	}
	// Walk each wall away from the corner, so a missing segment copies its finished neighbor.
	wall := func(x, y, rotation int, previous tile) error {
		at := tile{x, y}
		if !walls[at] {
			if err := add(roomWallItemID, x, y, rotation); err != nil {
				return err
			}
			walls[at] = true
		}
		if _, ok := papers[at]; !ok {
			paper := starterWallpaperItemID
			if neighbor, ok := papers[previous]; ok {
				paper = neighbor
			}
			if err := add(paper, x, y, rotation); err != nil {
				return err
			}
			papers[at] = paper
		}
		return nil
	}
	if !walls[tile{0, 0}] {
		if err := add(roomWallCornerItemID, 0, 0, 0); err != nil {
			return false, err
		}
	}
	for y := 1; y < tilesY; y++ {
		if err := wall(0, y, 0, tile{0, y - 1}); err != nil {
			return false, err
		}
	}
	for x := 1; x < tilesX; x++ {
		if err := wall(x, 0, 1, tile{x - 1, 0}); err != nil {
			return false, err
		}
	}
	for y := 1; y < tilesY; y++ {
		for x := 1; x < tilesX; x++ {
			if !floors[tile{x, y}] {
				if err := add(starterFloorItemID, x, y, 0); err != nil {
					return false, err
				}
			}
		}
	}
	return added, nil
}

// repairRoomShell fills the shell of rooms that were expanded without walls and floor.
func repairRoomShell(app core.App, userID string) error {
	return app.RunInTransaction(func(tx core.App) error {
		room, err := tx.FindFirstRecordByData("player_rooms", "user", userID)
		if err != nil {
			return err
		}
		added, err := fillRoomShell(tx, userID, room.GetInt("tiles_x"), room.GetInt("tiles_y"))
		if err != nil || !added {
			return err
		}
		room.Set("revision", room.GetInt("revision")+1)
		return tx.Save(room)
	})
}
