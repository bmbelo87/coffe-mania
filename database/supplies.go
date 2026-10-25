package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"coffe-mania/database/playerstate"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Supply orders wait on the delivery platform beside the cafe. Each order takes a slot,
// arrives after its delay, is collected box by box into the pantry (crates) for 1 energy
// and spoils if left too long. The pantry cap is the existing crates_max.
type supplyKind struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Seconds  int64  `json:"seconds"`
	Quantity int64  `json:"quantity"`
	Gold     int64  `json:"gold"`
	Level    int    `json:"level"`
	Rush     int64  `json:"rushGranas"`
	Source   string `json:"source"`
}

var supplyKinds = []supplyKind{
	{ID: "express", Name: "Express", Seconds: 10 * 60, Quantity: 4, Gold: 3000, Level: 1, Rush: 1,
		Source: "4 suprimentos em 10 min por 3.000 caféOuros [Com. 2011-04-12, 2011-04-13]. Nível e entrega imediata: balanceamento do projeto."},
	{ID: "media", Name: "Média", Seconds: 2 * 3600, Quantity: 15, Gold: 20000, Level: 2, Rush: 2,
		Source: "Sem fonte: tamanho, tempo, preço e nível são balanceamento do projeto entre a Express e a Premium."},
	{ID: "premium", Name: "Premium", Seconds: 12 * 3600, Quantity: 40, Gold: 75000, Level: 4, Rush: 3,
		Source: "40 suprimentos em 12 h por 75.000 caféOuros [Com. 2011-04-09, 2011-09-24]. Nível e entrega imediata: balanceamento do projeto."},
	{ID: "jumbo", Name: "Jumbo", Seconds: 24 * 3600, Quantity: 60, Gold: 125000, Level: 6, Rush: 4,
		Source: "60 suprimentos em 24 h por 125.000 caféOuros; terminar na hora por 4 caféGranas [Com. 2011-04-09, 2011-04-12, 2011-04-14]. Nível: balanceamento do projeto."},
}

const (
	// "Só pode pedir de 4 em 4" [Com. 2011-03-21, 2011-04-10].
	supplySlots = 4
	// "Cada recolhimento gasta 1 de energia" [Com. 2011-03-21].
	supplyCollectEnergy = 1
	// Salvar uma encomenda estragada [Blog 2011-09-14].
	supplySaveGranas = 1
	// How long an arrived box waits before spoiling: project balance, no source.
	supplyShelfLife = 24 * time.Hour
)

var (
	errSupplyConflict  = errors.New("A encomenda mudou. Atualize e tente novamente.")
	errSupplyUnknown   = errors.New("Encomenda inválida.")
	errSupplySlotsFull = errors.New("A plataforma está cheia: recolha uma encomenda antes de pedir outra.")
	errSupplyLevel     = errors.New("Esta encomenda ainda não está disponível no seu nível.")
	errSupplyGold      = errors.New("caféOuros insuficientes.")
	errSupplyGranas    = errors.New("caféGranas insuficientes.")
	errSupplyEnergy    = errors.New("Energia insuficiente para recolher a encomenda.")
	errSupplyPantry    = errors.New("Sua despensa está cheia.")
	errSupplyNotYet    = errors.New("A encomenda ainda está a caminho.")
	errSupplyArrived   = errors.New("A encomenda já chegou.")
	errSupplySpoiled   = errors.New("A encomenda estragou.")
	errSupplyFresh     = errors.New("A encomenda não está estragada.")
)

type supplyCommand struct {
	Kind      string `json:"kind,omitempty"`
	OrderID   string `json:"orderId,omitempty"`
	RequestID string `json:"requestId"`
}

type supplyOrder struct {
	ID        string `json:"id"`
	Slot      int    `json:"slot"`
	Kind      string `json:"kind"`
	Quantity  int64  `json:"quantity"`
	ArrivesAt int64  `json:"arrivesAt"`
	SpoilsAt  int64  `json:"spoilsAt"`
}

type supplySnapshot struct {
	ServerNow   int64                `json:"serverNow"`
	Slots       int                  `json:"slots"`
	Kinds       []supplyKind         `json:"kinds"`
	Orders      []supplyOrder        `json:"orders"`
	PlayerState playerstate.Snapshot `json:"playerState"`
	SaveGranas  int64                `json:"saveGranas"`
	Energy      int64                `json:"collectEnergy"`
}

func supplyKindByID(id string) (supplyKind, bool) {
	for _, kind := range supplyKinds {
		if kind.ID == id {
			return kind, true
		}
	}
	return supplyKind{}, false
}

func supplySpoilsAt(order *core.Record) time.Time {
	return order.GetDateTime("arrives_at").Time().Add(supplyShelfLife)
}

func snapshotSupplies(app core.App, owner string, now types.DateTime) (supplySnapshot, error) {
	result := supplySnapshot{ServerNow: now.Time().UnixMilli(), Slots: supplySlots, Kinds: supplyKinds, Orders: []supplyOrder{}, SaveGranas: supplySaveGranas, Energy: supplyCollectEnergy}
	err := app.RunInTransaction(func(tx core.App) error {
		state, err := playerstate.GetOrCreate(tx, owner)
		if err != nil {
			return err
		}
		// Collecting spends energy, so the HUD must show the regenerated value too.
		row, err := juiceRecord(tx, owner, now)
		if err != nil {
			return err
		}
		previousAt, previousEnergy := row.GetDateTime("energy_at"), state.GetInt64("energy_current")
		regenerateJuiceEnergy(row, state, now)
		if row.GetDateTime("energy_at") != previousAt {
			if err = tx.Save(row); err != nil {
				return err
			}
		}
		if state.GetInt64("energy_current") != previousEnergy {
			if err = tx.Save(state); err != nil {
				return err
			}
		}
		rows, err := tx.FindRecordsByFilter("supply_orders", "user={:user}", "slot", 0, 0, dbx.Params{"user": owner})
		if err != nil {
			return err
		}
		for _, order := range rows {
			result.Orders = append(result.Orders, supplyOrder{
				ID: order.Id, Slot: order.GetInt("slot"), Kind: order.GetString("kind"), Quantity: order.GetInt64("quantity"),
				ArrivesAt: order.GetDateTime("arrives_at").Time().UnixMilli(), SpoilsAt: supplySpoilsAt(order).UnixMilli(),
			})
		}
		result.PlayerState = playerstate.View(state)
		return nil
	})
	return result, err
}

// Every mutation and its receipt share one transaction; repeating a request key with the
// same body is a no-op and with another body is a conflict.
func mutateSupplies(app core.App, owner, action string, body supplyCommand, now types.DateTime) error {
	if !requestKeyPattern.MatchString(body.RequestID) {
		return errSupplyConflict
	}
	data, _ := json.Marshal(struct {
		Action string
		Body   supplyCommand
	}{action, body})
	sum := sha256.Sum256(data)
	payload := hex.EncodeToString(sum[:])
	at := now.Time()
	return app.RunInTransaction(func(tx core.App) error {
		old, err := tx.FindFirstRecordByFilter("supply_operations", "user={:user} && request_key={:key}", dbx.Params{"user": owner, "key": body.RequestID})
		if err == nil {
			if old.GetString("payload") != payload {
				return errSupplyConflict
			}
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		state, err := tx.FindFirstRecordByData(playerstate.Collection, "user", owner)
		if err != nil {
			return err
		}
		var order *core.Record
		if action != "order" {
			order, err = tx.FindRecordById("supply_orders", body.OrderID)
			if err != nil || order.GetString("user") != owner {
				return errSupplyUnknown
			}
		}
		switch action {
		case "order":
			kind, ok := supplyKindByID(body.Kind)
			if !ok {
				return errSupplyUnknown
			}
			if state.GetInt("level") < kind.Level {
				return errSupplyLevel
			}
			rows, err := tx.FindRecordsByFilter("supply_orders", "user={:user}", "slot", 0, 0, dbx.Params{"user": owner})
			if err != nil {
				return err
			}
			taken := map[int]bool{}
			for _, row := range rows {
				taken[row.GetInt("slot")] = true
			}
			slot := -1
			for candidate := 0; candidate < supplySlots; candidate++ {
				if !taken[candidate] {
					slot = candidate
					break
				}
			}
			if slot < 0 {
				return errSupplySlotsFull
			}
			if state.GetInt64("gold") < kind.Gold {
				return errSupplyGold
			}
			state.Set("gold", state.GetInt64("gold")-kind.Gold)
			tagLedger(state, "encomenda", kind.ID)
			collection, err := tx.FindCollectionByNameOrId("supply_orders")
			if err != nil {
				return err
			}
			order = core.NewRecord(collection)
			order.Load(map[string]any{"user": owner, "slot": slot, "kind": kind.ID, "quantity": kind.Quantity, "arrives_at": now.Add(time.Duration(kind.Seconds) * time.Second)})
		case "rush":
			kind, ok := supplyKindByID(order.GetString("kind"))
			if !ok {
				return errSupplyUnknown
			}
			if !at.Before(order.GetDateTime("arrives_at").Time()) {
				return errSupplyArrived
			}
			if state.GetInt64("cash") < kind.Rush {
				return errSupplyGranas
			}
			state.Set("cash", state.GetInt64("cash")-kind.Rush)
			tagLedger(state, "encomenda_pressa", kind.ID)
			order.Set("arrives_at", now)
		case "collect":
			if at.Before(order.GetDateTime("arrives_at").Time()) {
				return errSupplyNotYet
			}
			if !at.Before(supplySpoilsAt(order)) {
				return errSupplySpoiled
			}
			space := state.GetInt64("crates_max") - state.GetInt64("crates_current")
			if space <= 0 {
				return errSupplyPantry
			}
			row, err := juiceRecord(tx, owner, now)
			if err != nil {
				return err
			}
			regenerateJuiceEnergy(row, state, now)
			energy := state.GetInt64("energy_current")
			if energy < supplyCollectEnergy {
				return errSupplyEnergy
			}
			if energy >= state.GetInt64("energy_max") {
				// Regeneration restarts from the moment the bar leaves its maximum.
				row.Set("energy_at", now)
			}
			if err = tx.Save(row); err != nil {
				return err
			}
			taken := min(space, order.GetInt64("quantity"))
			state.Set("energy_current", energy-supplyCollectEnergy)
			state.Set("crates_current", state.GetInt64("crates_current")+taken)
			order.Set("quantity", order.GetInt64("quantity")-taken)
		case "save":
			if at.Before(supplySpoilsAt(order)) {
				return errSupplyFresh
			}
			if state.GetInt64("cash") < supplySaveGranas {
				return errSupplyGranas
			}
			state.Set("cash", state.GetInt64("cash")-supplySaveGranas)
			tagLedger(state, "encomenda_salvar", order.GetString("kind"))
			// A saved box is as fresh as one that just arrived.
			order.Set("arrives_at", now)
		case "discard":
			if at.Before(supplySpoilsAt(order)) {
				return errSupplyFresh
			}
			order.Set("quantity", 0)
		default:
			return errSupplyUnknown
		}
		if err = tx.Save(state); err != nil {
			return err
		}
		if order.GetInt64("quantity") <= 0 {
			if err = tx.Delete(order); err != nil {
				return err
			}
		} else if err = tx.Save(order); err != nil {
			return err
		}
		collection, err := tx.FindCollectionByNameOrId("supply_operations")
		if err != nil {
			return err
		}
		receipt := core.NewRecord(collection)
		receipt.Load(map[string]any{"user": owner, "request_key": body.RequestID, "payload": payload})
		return tx.Save(receipt)
	})
}

func registerSupplyRoutes(e *core.ServeEvent) {
	e.Router.GET("/api/coffe/supplies", func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		user := sessionRecord(r)
		if user == nil {
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		snapshot, err := snapshotSupplies(r.App, user.Id, types.NowDateTime())
		if err != nil {
			return r.InternalServerError("Não foi possível carregar as encomendas.", err)
		}
		return r.JSON(http.StatusOK, snapshot)
	})
	for _, action := range []string{"order", "rush", "collect", "save", "discard"} {
		e.Router.POST("/api/coffe/supplies/"+action, func(r *core.RequestEvent) error {
			r.Response.Header().Set("Cache-Control", "no-store")
			user := sessionRecord(r)
			if user == nil {
				return r.UnauthorizedError("Entre para jogar.", nil)
			}
			var body supplyCommand
			if r.BindBody(&body) != nil {
				return r.BadRequestError("Pedido inválido.", nil)
			}
			now := types.NowDateTime()
			if err := mutateSupplies(r.App, user.Id, action, body, now); err != nil {
				if errors.Is(err, errSupplyUnknown) {
					return r.BadRequestError(err.Error(), nil)
				}
				for _, known := range []error{errSupplyConflict, errSupplySlotsFull, errSupplyLevel, errSupplyGold, errSupplyGranas, errSupplyEnergy, errSupplyPantry, errSupplyNotYet, errSupplyArrived, errSupplySpoiled, errSupplyFresh} {
					if errors.Is(err, known) {
						return apis.NewApiError(http.StatusConflict, err.Error(), nil)
					}
				}
				return r.InternalServerError("Não foi possível atualizar a encomenda.", err)
			}
			snapshot, err := snapshotSupplies(r.App, user.Id, now)
			if err != nil {
				return r.InternalServerError("Encomenda salva; recarregue para atualizar.", err)
			}
			return r.JSON(http.StatusOK, snapshot)
		}).Bind(apis.BodyLimit(1024)).BindFunc(func(r *core.RequestEvent) error {
			if r.Request.Header.Get("Origin") == "" {
				return r.ForbiddenError("Origem inválida.", nil)
			}
			return sameOrigin(r)
		})
	}
}
