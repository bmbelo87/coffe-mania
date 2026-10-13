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
	"coffe-mania/shared/gamewire"
	"coffe-mania/shared/juicecatalog"
	"coffe-mania/shared/roomcatalog"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

const juiceEnergyInterval = 4 * time.Minute

var errJuiceConflict = errors.New("A máquina ou o pedido de suco mudou. Atualize e tente novamente.")

type juiceCommand struct {
	MachineID      string `json:"machineId"`
	RecipeID       string `json:"recipeId"`
	ActorID        string `json:"actorId"`
	RequestID      string `json:"requestId"`
	JuiceRequestID string `json:"juiceRequestId,omitempty"`
}
type juiceBatch struct {
	RecipeID string `json:"recipeId"`
	Portions int    `json:"portions"`
}
type juiceSnapshot struct {
	Unlocked        bool                  `json:"unlocked"`
	Stock           map[string]juiceBatch `json:"stock"`
	Mastery         map[string]int        `json:"mastery"`
	Groups          []string              `json:"groups"`
	MasteryServings int                   `json:"masteryServings"`
	PlayerState     playerstate.Snapshot  `json:"playerState"`
	EvolutionStage  int                   `json:"evolutionStage"`
}

func juiceRecord(app core.App, owner string, now types.DateTime) (*core.Record, error) {
	row, err := app.FindFirstRecordByData("juice_state", "user", owner)
	if err == nil {
		return row, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	collection, err := app.FindCollectionByNameOrId("juice_state")
	if err != nil {
		return nil, err
	}
	row = core.NewRecord(collection)
	row.Load(map[string]any{"user": owner, "stock": map[string]juiceBatch{}, "mastery": map[string]int{}, "energy_at": now})
	return row, app.Save(row)
}
func juiceData(row *core.Record) (map[string]juiceBatch, map[string]int) {
	stock := map[string]juiceBatch{}
	mastery := map[string]int{}
	_ = row.UnmarshalJSONField("stock", &stock)
	_ = row.UnmarshalJSONField("mastery", &mastery)
	if stock == nil {
		stock = map[string]juiceBatch{}
	}
	if mastery == nil {
		mastery = map[string]int{}
	}
	return stock, mastery
}
func regenerateJuiceEnergy(row, state *core.Record, now types.DateTime) {
	at := row.GetDateTime("energy_at").Time()
	current, maximum := state.GetInt64("energy_current"), state.GetInt64("energy_max")
	if at.IsZero() || current >= maximum {
		row.Set("energy_at", now)
		return
	}
	elapsed := now.Time().Sub(at)
	steps := int64(elapsed / juiceEnergyInterval)
	if steps < 1 {
		return
	}
	state.Set("energy_current", min(maximum, current+steps))
	row.Set("energy_at", now.Add(-elapsed+time.Duration(steps)*juiceEnergyInterval))
}
func snapshotJuices(app core.App, owner string, now types.DateTime) (juiceSnapshot, error) {
	var result juiceSnapshot
	err := app.RunInTransaction(func(tx core.App) error {
		row, err := juiceRecord(tx, owner, now)
		if err != nil {
			return err
		}
		state, err := tx.FindFirstRecordByData(playerstate.Collection, "user", owner)
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
		stock, mastery := juiceData(row)
		groups := []string{}
		for _, g := range []string{"basic", "medium", "tropical"} {
			if juicecatalog.Unlocked(g, mastery) {
				groups = append(groups, g)
			}
		}
		result = juiceSnapshot{row.GetBool("unlocked"), stock, mastery, groups, juicecatalog.MasteryServings, playerstate.View(state), juicecatalog.EvolutionStage(mastery)}
		return nil
	})
	return result, err
}
func publicJuices(app core.App, owner string) ([]gamewire.JuiceStock, error) {
	result := []gamewire.JuiceStock{}
	row, err := app.FindFirstRecordByData("juice_state", "user", owner)
	if errors.Is(err, sql.ErrNoRows) {
		return result, nil
	}
	if err != nil {
		return nil, err
	}
	stock, mastery := juiceData(row)
	units, err := app.FindRecordsByFilter("player_inventory", "user={:user} && placed=true", "id", 0, 0, dbx.Params{"user": owner})
	if err != nil {
		return nil, err
	}
	for _, unit := range units {
		item, ok := roomcatalog.ByID(unit.GetInt("item_id"))
		if ok && item.Kind == "juice_machine" {
			batch := stock[unit.Id]
			result = append(result, gamewire.JuiceStock{MachineID: unit.Id, RecipeID: batch.RecipeID, Portions: batch.Portions, Unlocked: row.GetBool("unlocked"), Stage: juicecatalog.EvolutionStage(mastery)})
		}
	}
	return result, nil
}
func mutateJuice(app core.App, owner, action string, body juiceCommand, now types.DateTime) error {
	if !requestKeyPattern.MatchString(body.RequestID) {
		return errJuiceConflict
	}
	data, _ := json.Marshal(struct {
		Action string
		Body   juiceCommand
	}{action, body})
	sum := sha256.Sum256(data)
	payload := hex.EncodeToString(sum[:])
	return app.RunInTransaction(func(tx core.App) error {
		old, err := tx.FindFirstRecordByFilter("juice_operations", "user={:user} && request_key={:key}", dbx.Params{"user": owner, "key": body.RequestID})
		if err == nil {
			if old.GetString("payload") != payload {
				return errJuiceConflict
			}
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		unit, err := tx.FindRecordById("player_inventory", body.MachineID)
		if err != nil || unit.GetString("user") != owner || !unit.GetBool("placed") {
			return errRoomOwned
		}
		item, ok := roomcatalog.ByID(unit.GetInt("item_id"))
		if !ok || item.Kind != "juice_machine" {
			return errRoomOwned
		}
		row, err := juiceRecord(tx, owner, now)
		if err != nil {
			return err
		}
		state, err := tx.FindFirstRecordByData(playerstate.Collection, "user", owner)
		if err != nil {
			return err
		}
		regenerateJuiceEnergy(row, state, now)
		stock, mastery := juiceData(row)
		switch action {
		case "juice_unlock":
			if row.GetBool("unlocked") {
				return errJuiceConflict
			}
			if state.GetInt64("cash") < 20 {
				return errors.New("Você precisa de 20 caféGranas para contratar o chaveiro.")
			}
			state.Set("cash", state.GetInt64("cash")-20)
			row.Set("unlocked", true)
		case "juice_recharge":
			if state.GetInt64("energy_current") >= state.GetInt64("energy_max") {
				return errors.New("Sua energia já está completa.")
			}
			if state.GetInt64("cash") < 4 {
				return errors.New("Você precisa de 4 caféGranas para recarregar.")
			}
			state.Set("cash", state.GetInt64("cash")-4)
			state.Set("energy_current", state.GetInt64("energy_max"))
			row.Set("energy_at", now)
		case "juice_prepare":
			recipe, ok := juicecatalog.ByID(body.RecipeID)
			if !ok {
				return errors.New("Suco desconhecido.")
			}
			if !row.GetBool("unlocked") || !juicecatalog.Unlocked(recipe.Group, mastery) {
				return errors.New("Destrave a máquina e domine os sabores anteriores.")
			}
			if stock[unit.Id].Portions > 0 {
				return errors.New("Sirva os copos restantes antes de preparar outro suco.")
			}
			if state.GetInt64("energy_current") < recipe.EnergyCost {
				return errors.New("Energia insuficiente. Aguarde a recarga ou recarregue sua energia.")
			}
			if state.GetInt64("energy_current") >= state.GetInt64("energy_max") {
				row.Set("energy_at", now)
			}
			state.Set("energy_current", state.GetInt64("energy_current")-recipe.EnergyCost)
			stock[unit.Id] = juiceBatch{recipe.ID, recipe.Portions}
		case "juice_serve":
			// The room server substitutes this nonce after checking the live thirsty customer.
			if body.ActorID == "" || body.JuiceRequestID == "" || body.RequestID != body.JuiceRequestID {
				return errJuiceConflict
			}
			batch := stock[unit.Id]
			recipe, ok := juicecatalog.ByID(batch.RecipeID)
			if !ok || batch.Portions < 1 {
				return errors.New("A máquina não tem suco pronto.")
			}
			batch.Portions--
			stock[unit.Id] = batch
			mastery[recipe.ID]++
			state.Set("gold", state.GetInt64("gold")+recipe.Gold)
			playerstate.GrantExperience(state, recipe.XP)
			playerstate.AdjustPopularity(state, recipe.PopularityTenths)
		default:
			return errJuiceConflict
		}
		row.Set("stock", stock)
		row.Set("mastery", mastery)
		if err = tx.Save(row); err != nil {
			return err
		}
		if err = tx.Save(state); err != nil {
			return err
		}
		collection, err := tx.FindCollectionByNameOrId("juice_operations")
		if err != nil {
			return err
		}
		op := core.NewRecord(collection)
		op.Load(map[string]any{"user": owner, "request_key": body.RequestID, "payload": payload})
		return tx.Save(op)
	})
}
func registerJuiceRoutes(e *core.ServeEvent) {
	e.Router.GET("/api/coffe/juices", func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		user := sessionRecord(r)
		if user == nil {
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		snapshot, err := snapshotJuices(r.App, user.Id, types.NowDateTime())
		if err != nil {
			return r.InternalServerError("Não foi possível carregar os sucos.", err)
		}
		return r.JSON(http.StatusOK, snapshot)
	})
	for _, action := range []string{"unlock", "prepare", "serve", "recharge"} {
		e.Router.POST("/api/coffe/juices/"+action, func(r *core.RequestEvent) error {
			r.Response.Header().Set("Cache-Control", "no-store")
			user := sessionRecord(r)
			if user == nil {
				return r.UnauthorizedError("Entre para jogar.", nil)
			}
			var body juiceCommand
			if r.BindBody(&body) != nil {
				return r.BadRequestError("Pedido inválido.", nil)
			}
			return proxyRoomOperation(r, user.Id, "juice_"+action, body)
		}).Bind(apis.BodyLimit(2048)).BindFunc(func(r *core.RequestEvent) error {
			if r.Request.Header.Get("Origin") == "" {
				return r.ForbiddenError("Origem inválida.", nil)
			}
			return sameOrigin(r)
		})
	}
}
