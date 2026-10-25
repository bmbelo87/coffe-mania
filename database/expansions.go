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

// The patio ("Pátio", 20/10/2010) is the open-air lot sold by the "Terreno à venda" sign: no walls,
// a grass floor, and customers are served there as in the dining room. Each purchase sets it to a
// fixed size, first 4x4 and then 7x6; the launch allowed exactly two patio expansions. "O tamanho
// máximo de um pátio é o mesmo que o do Café": a step larger than the café floor waits for a café
// expansion. The first step uses the documented window (40000 caféOuros or 10 caféGranas, level
// 15, unlock for 10); the "Bloqueado!" capture that asks for 35 neighbors unlocks for 20, used
// for the second step. Its prices and level are project values.
var patioSteps = []expansionStep{
	{FloorX: 4, FloorY: 4, Level: 15, PriceCash: 10, PriceGold: 40000, UnlockCash: 10},
	{FloorX: 7, FloorY: 6, Level: 25, PriceCash: 20, PriceGold: 80000, UnlockCash: 20},
}

// Floor of a new café, before any expansion (row and column 0 hold the walls).
const starterFloorX, starterFloorY = 6, 9

// Starter shell pieces, the same ones ensureRoom places in a new café; the patio starts as grass.
const (
	starterFloorItemID     = 3050000
	starterWallpaperItemID = 3060016
	roomWallItemID         = 3090000
	roomWallCornerItemID   = 3090001
	patioFloorItemID       = 9050105
)

var errExpansionLevel = errors.New("Seu nível ainda não libera esta expansão. Destrave antes ou pague em caféGranas.")
var errExpansionMax = errors.New("O café já está no tamanho máximo.")
var errExpansionCash = errors.New("caféGranas insuficientes.")
var errExpansionPayment = errors.New("Forma de pagamento inválida.")
var errPatioMax = errors.New("O pátio já está no tamanho máximo.")
var errPatioCafe = errors.New("O tamanho máximo de um pátio é o mesmo que o do Café. Expanda seu Café primeiro.")

type expansionStep struct {
	FloorX     int   `json:"floorX"`
	FloorY     int   `json:"floorY"`
	Level      int   `json:"level"`
	PriceCash  int64 `json:"priceCash"`
	PriceGold  int64 `json:"priceGold"`
	UnlockCash int64 `json:"unlockCash"`
}

// expansionOffer is the next block for sale; nil once the café or the patio reached its maximum.
type expansionOffer struct {
	expansionStep
	Step  int `json:"step"`
	Steps int `json:"steps"`
}

// roomArea is the walkable shape of a room: the café rectangle (row and column 0 hold its walls)
// and the patio beyond its front-left edge, from the first floor column. The patio has no walls,
// so the café's wall column does not continue along it.
type roomArea struct{ TilesX, TilesY, PatioX, PatioY int }

func areaOf(room *core.Record) roomArea {
	return roomArea{room.GetInt("tiles_x"), room.GetInt("tiles_y"), room.GetInt("patio_x"), room.GetInt("patio_y")}
}

func (a roomArea) contains(x, y int) bool {
	if x < 0 || y < 0 {
		return false
	}
	if y < a.TilesY {
		return x < a.TilesX
	}
	return x >= 1 && x <= a.PatioX && y < a.TilesY+a.PatioY
}

// nextStep returns the first step whose floor the given size does not cover yet. Rooms resized
// in another way skip the steps they already contain.
func nextStep(steps []expansionStep, floorX, floorY int) (expansionStep, int, bool) {
	for index, step := range steps {
		if step.FloorX > floorX || step.FloorY > floorY {
			return step, index + 1, true
		}
	}
	return expansionStep{}, 0, false
}

func offerFor(steps []expansionStep, floorX, floorY int) *expansionOffer {
	step, index, ok := nextStep(steps, floorX, floorY)
	if !ok {
		return nil
	}
	return &expansionOffer{expansionStep: step, Step: index, Steps: len(steps)}
}

func nextExpansion(tilesX, tilesY int) (expansionStep, int, bool) {
	return nextStep(expansionSteps, tilesX-1, tilesY-1)
}

func expansionFor(tilesX, tilesY int) *expansionOffer {
	return offerFor(expansionSteps, tilesX-1, tilesY-1)
}

func patioFor(area roomArea) *expansionOffer {
	return offerFor(patioSteps, area.PatioX, area.PatioY)
}

// mutateExpansion grows the café by its next step. When it gains rows, the patio and everything
// placed on it move with the café's front-left edge, so the lot stays attached.
func mutateExpansion(app core.App, userID string, command roomCommand) (roomSnapshot, error) {
	return buyRoomStep(app, userID, "expand", command, func(tx core.App, room *core.Record) (expansionStep, error) {
		step, _, ok := nextExpansion(room.GetInt("tiles_x"), room.GetInt("tiles_y"))
		if !ok {
			return step, errExpansionMax
		}
		return step, nil
	}, func(tx core.App, room *core.Record, step expansionStep) error {
		oldY := room.GetInt("tiles_y")
		room.Set("tiles_x", max(room.GetInt("tiles_x"), step.FloorX+1))
		room.Set("tiles_y", max(oldY, step.FloorY+1))
		if shift := room.GetInt("tiles_y") - oldY; shift > 0 && room.GetInt("patio_y") > 0 {
			return shiftPatio(tx, userID, oldY, shift)
		}
		return nil
	})
}

// mutatePatio buys the next patio lot at the "Terreno à venda" sign.
func mutatePatio(app core.App, userID string, command roomCommand) (roomSnapshot, error) {
	return buyRoomStep(app, userID, "patio", command, func(tx core.App, room *core.Record) (expansionStep, error) {
		area := areaOf(room)
		step, _, ok := nextStep(patioSteps, area.PatioX, area.PatioY)
		if !ok {
			return step, errPatioMax
		}
		if step.FloorX > area.TilesX-1 || step.FloorY > area.TilesY-1 {
			return step, errPatioCafe
		}
		return step, nil
	}, func(tx core.App, room *core.Record, step expansionStep) error {
		room.Set("patio_x", max(room.GetInt("patio_x"), step.FloorX))
		room.Set("patio_y", max(room.GetInt("patio_y"), step.FloorY))
		return nil
	})
}

// buyRoomStep pays for a step and applies it in one transaction. Payment is "cash" (caféGranas, no
// requirement), "gold" (caféOuros, needs the level) or "gold_unlock" (caféOuros plus the unlock
// price in caféGranas, which waives the level). The revision check and the request key follow
// mutateRoom, so a retried request never charges twice. The shell (walls, wallpaper and floor) of
// the new tiles is filled before saving.
func buyRoomStep(app core.App, userID, action string, command roomCommand,
	next func(core.App, *core.Record) (expansionStep, error), apply func(core.App, *core.Record, expansionStep) error) (roomSnapshot, error) {
	var result roomSnapshot
	payloadBytes, _ := json.Marshal(struct {
		Action  string
		Command roomCommand
	}{action, command})
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
		step, err := next(tx, room)
		if err != nil {
			return err
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
		tagLedger(state, "expansao", command.Payment)
		if err := tx.Save(state); err != nil {
			return err
		}
		if err := apply(tx, room, step); err != nil {
			return err
		}
		if _, err := fillRoomShell(tx, userID, areaOf(room)); err != nil {
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

// shiftPatio moves every piece placed on the patio (rows from fromY on) by the rows the café
// gained, with the cooking slot of a stove standing there.
func shiftPatio(tx core.App, userID string, fromY, shift int) error {
	for _, collection := range []string{"player_inventory", "player_stoves"} {
		filter := "user={:user} && ty>={:y}"
		if collection == "player_inventory" {
			filter += " && placed=true"
		}
		// Farthest rows first: positions are unique per layer, so each target tile is already free.
		records, err := tx.FindRecordsByFilter(collection, filter, "-ty", 0, 0, dbx.Params{"user": userID, "y": fromY})
		if err != nil {
			return err
		}
		for _, record := range records {
			record.Set("ty", record.GetInt("ty")+shift)
			if err := tx.Save(record); err != nil {
				return err
			}
		}
	}
	return nil
}

// fillRoomShell places the starter wall, wallpaper and floor on every café tile that lacks them,
// and grass on every patio tile without a floor: the new block of an expansion, and rooms
// expanded before the shell was filled. New wall segments continue the wallpaper of the segment
// before them on the same wall. It reports whether anything was added.
func fillRoomShell(tx core.App, userID string, area roomArea) (bool, error) {
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
	for y := 1; y < area.TilesY; y++ {
		if err := wall(0, y, 0, tile{0, y - 1}); err != nil {
			return false, err
		}
	}
	for x := 1; x < area.TilesX; x++ {
		if err := wall(x, 0, 1, tile{x - 1, 0}); err != nil {
			return false, err
		}
	}
	for y := 1; y < area.TilesY+area.PatioY; y++ {
		for x := 1; x < area.TilesX; x++ {
			if !area.contains(x, y) || floors[tile{x, y}] {
				continue
			}
			floor := starterFloorItemID
			if y >= area.TilesY {
				floor = patioFloorItemID
			}
			if err := add(floor, x, y, 0); err != nil {
				return false, err
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
		added, err := fillRoomShell(tx, userID, areaOf(room))
		if err != nil || !added {
			return err
		}
		room.Set("revision", room.GetInt("revision")+1)
		return tx.Save(room)
	})
}
