package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"

	"coffe-mania/database/playerstate"
	"coffe-mania/shared/coffeecatalog"
	"coffe-mania/shared/gamewire"
	"coffe-mania/shared/roomcatalog"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var errCoffeeConflict = errors.New("A máquina ou o pedido de café mudou. Atualize e tente novamente.")

type coffeeCommand struct {
	MachineID       string `json:"machineId"`
	RecipeID        string `json:"recipeId,omitempty"`
	ActorID         string `json:"actorId,omitempty"`
	RequestID       string `json:"requestId"`
	CoffeeRequestID string `json:"coffeeRequestId,omitempty"`
}

type coffeeReward struct {
	RecipeID  string `json:"recipeId"`
	Name      string `json:"name"`
	Eligible  bool   `json:"eligible"`
	Delivered bool   `json:"delivered"`
	Pending   bool   `json:"pending"`
}

type coffeeSnapshot struct {
	Selected          map[string]string    `json:"selected"`
	Mastery           map[string]int       `json:"mastery"`
	Groups            []string             `json:"groups"`
	MasteryThresholds [3]int               `json:"masteryThresholds"`
	EvolutionStage    int                  `json:"evolutionStage"`
	PlayerState       playerstate.Snapshot `json:"playerState"`
	Rewards           []coffeeReward       `json:"rewards"`
}

func coffeeRecord(app core.App, owner string) (*core.Record, error) {
	row, err := app.FindFirstRecordByData("coffee_state", "user", owner)
	if err == nil {
		return row, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	collection, err := app.FindCollectionByNameOrId("coffee_state")
	if err != nil {
		return nil, err
	}
	row = core.NewRecord(collection)
	row.Load(map[string]any{"user": owner, "selected": map[string]string{}, "mastery": map[string]int{}})
	return row, app.Save(row)
}

func coffeeData(row *core.Record) (map[string]string, map[string]int) {
	selected, mastery := map[string]string{}, map[string]int{}
	if row != nil {
		_ = row.UnmarshalJSONField("selected", &selected)
		_ = row.UnmarshalJSONField("mastery", &mastery)
	}
	if selected == nil {
		selected = map[string]string{}
	}
	if mastery == nil {
		mastery = map[string]int{}
	}
	for id, count := range mastery {
		if count < 0 {
			mastery[id] = 0
		}
	}
	return selected, mastery
}

func coffeeUnits(app core.App, owner string, placedOnly bool) ([]*core.Record, error) {
	filter := "user={:user}"
	if placedOnly {
		filter += " && placed=true"
	}
	units, err := app.FindRecordsByFilter("player_inventory", filter, "id", 0, 0, dbx.Params{"user": owner})
	if err != nil {
		return nil, err
	}
	result := []*core.Record{}
	for _, unit := range units {
		if item, ok := roomcatalog.ByID(unit.GetInt("item_id")); ok && item.Kind == "coffee_machine" {
			result = append(result, unit)
		}
	}
	return result, nil
}

func coffeeRecipeID(selected map[string]string, unit string) string {
	if _, ok := coffeecatalog.ByID(selected[unit]); ok {
		return selected[unit]
	}
	return coffeecatalog.DefaultRecipeID
}

func snapshotCoffees(app core.App, owner string, now types.DateTime) (coffeeSnapshot, error) {
	var result coffeeSnapshot
	err := app.RunInTransaction(func(tx core.App) error {
		row, err := coffeeRecord(tx, owner)
		if err != nil {
			return err
		}
		state, err := tx.FindFirstRecordByData(playerstate.Collection, "user", owner)
		if err != nil {
			return err
		}
		// All energy users share this existing clock; a coffee-specific clock would regenerate twice.
		clock, err := juiceRecord(tx, owner, now)
		if err != nil {
			return err
		}
		previousAt, previousEnergy := clock.GetDateTime("energy_at"), state.GetInt64("energy_current")
		// A full bar is reanchored when a confirmed action spends it, not on every panel refresh.
		if previousEnergy < state.GetInt64("energy_max") || previousAt.Time().IsZero() {
			regenerateJuiceEnergy(clock, state, now)
		}
		if clock.GetDateTime("energy_at") != previousAt {
			if err = tx.Save(clock); err != nil {
				return err
			}
		}
		if state.GetInt64("energy_current") != previousEnergy {
			if err = tx.Save(state); err != nil {
				return err
			}
		}
		selected, mastery := coffeeData(row)
		units, err := coffeeUnits(tx, owner, false)
		if err != nil {
			return err
		}
		effective := map[string]string{}
		for _, unit := range units {
			effective[unit.Id] = coffeeRecipeID(selected, unit.Id)
		}
		groups := []string{}
		for _, group := range coffeecatalog.Groups {
			if coffeecatalog.Unlocked(group, mastery) {
				groups = append(groups, group)
			}
		}
		receipts, err := tx.FindRecordsByFilter("coffee_rewards", "user={:user}", "recipe_id", 0, 0, dbx.Params{"user": owner})
		if err != nil {
			return err
		}
		delivered := map[string]bool{}
		for _, receipt := range receipts {
			delivered[receipt.GetString("recipe_id")] = receipt.GetBool("delivered")
		}
		rewards := []coffeeReward{}
		for _, recipe := range coffeecatalog.Recipes {
			if recipe.MasteryReward != "" && coffeecatalog.MasteryLevel(mastery[recipe.ID]) == 3 {
				rewards = append(rewards, coffeeReward{recipe.ID, recipe.MasteryReward, true, delivered[recipe.ID], !delivered[recipe.ID]})
			}
		}
		result = coffeeSnapshot{effective, mastery, groups, coffeecatalog.MasteryThresholds, coffeecatalog.EvolutionStage(mastery), playerstate.View(state), rewards}
		return nil
	})
	return result, err
}

func publicCoffees(app core.App, owner string) ([]gamewire.CoffeeMachine, error) {
	result := []gamewire.CoffeeMachine{}
	row, err := app.FindFirstRecordByData("coffee_state", "user", owner)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	selected, mastery := coffeeData(row)
	units, err := coffeeUnits(app, owner, true)
	if err != nil {
		return nil, err
	}
	for _, unit := range units {
		result = append(result, gamewire.CoffeeMachine{MachineID: unit.Id, RecipeID: coffeeRecipeID(selected, unit.Id), Stage: coffeecatalog.EvolutionStage(mastery)})
	}
	return result, nil
}

func recordCoffeeReward(app core.App, owner string, recipe coffeecatalog.Recipe, count int, now types.DateTime) error {
	if recipe.MasteryReward == "" || coffeecatalog.MasteryLevel(count) != 3 {
		return nil
	}
	_, err := app.FindFirstRecordByFilter("coffee_rewards", "user={:user} && recipe_id={:recipe}", dbx.Params{"user": owner, "recipe": recipe.ID})
	if err == nil {
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	collection, err := app.FindCollectionByNameOrId("coffee_rewards")
	if err != nil {
		return err
	}
	receipt := core.NewRecord(collection)
	// Eligibility is durable, but M06 delivery awaits a verified item mapping and its real art.
	receipt.Load(map[string]any{"user": owner, "recipe_id": recipe.ID, "reward_name": recipe.MasteryReward, "delivered": false, "eligible_at": now})
	return app.Save(receipt)
}

func mutateCoffee(app core.App, owner, action string, body coffeeCommand, now types.DateTime) error {
	if !requestKeyPattern.MatchString(body.RequestID) {
		return errCoffeeConflict
	}
	data, _ := json.Marshal(struct {
		Action string
		Body   coffeeCommand
	}{action, body})
	sum := sha256.Sum256(data)
	payload := hex.EncodeToString(sum[:])
	return app.RunInTransaction(func(tx core.App) error {
		old, err := tx.FindFirstRecordByFilter("coffee_operations", "user={:user} && request_key={:key}", dbx.Params{"user": owner, "key": body.RequestID})
		if err == nil {
			if old.GetString("payload") != payload {
				return errCoffeeConflict
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
		if !ok || item.Kind != "coffee_machine" {
			return errRoomOwned
		}
		row, err := coffeeRecord(tx, owner)
		if err != nil {
			return err
		}
		selected, mastery := coffeeData(row)
		state, err := tx.FindFirstRecordByData(playerstate.Collection, "user", owner)
		if err != nil {
			return err
		}
		clock, err := juiceRecord(tx, owner, now)
		if err != nil {
			return err
		}
		regenerateJuiceEnergy(clock, state, now)
		switch action {
		case "coffee_select":
			recipe, ok := coffeecatalog.ByID(body.RecipeID)
			if !ok || !coffeecatalog.Unlocked(recipe.Group, mastery) {
				return errors.New("Domine os cafés anteriores para selecionar este sabor.")
			}
			selected[unit.Id] = recipe.ID
		case "coffee_serve":
			// The room validates the live customer and replaces the payment key with this server nonce.
			if body.ActorID == "" || body.CoffeeRequestID == "" || body.RequestID != body.CoffeeRequestID {
				return errCoffeeConflict
			}
			recipe, ok := coffeecatalog.ByID(coffeeRecipeID(selected, unit.Id))
			if !ok || !coffeecatalog.Unlocked(recipe.Group, mastery) || (body.RecipeID != "" && body.RecipeID != recipe.ID) {
				return errCoffeeConflict
			}
			energy := state.GetInt64("energy_current")
			if energy < recipe.EnergyCost {
				return errors.New("Energia insuficiente para servir este café. Aguarde a recarga ou recarregue sua energia.")
			}
			if energy >= state.GetInt64("energy_max") {
				clock.Set("energy_at", now)
			}
			state.Set("energy_current", energy-recipe.EnergyCost)
			state.Set("gold", state.GetInt64("gold")+recipe.Gold)
			playerstate.GrantExperience(state, recipe.XP)
			playerstate.AdjustPopularity(state, recipe.PopularityTenths)
			mastery[recipe.ID]++
			if err = recordCoffeeReward(tx, owner, recipe, mastery[recipe.ID], now); err != nil {
				return err
			}
		case "coffee_recharge":
			if state.GetInt64("energy_current") >= state.GetInt64("energy_max") {
				return errors.New("Sua energia já está completa.")
			}
			if state.GetInt64("cash") < coffeecatalog.RechargeCash {
				return errors.New("Você precisa de 4 caféGranas para recarregar.")
			}
			state.Set("cash", state.GetInt64("cash")-coffeecatalog.RechargeCash)
			state.Set("energy_current", state.GetInt64("energy_max"))
			clock.Set("energy_at", now)
		default:
			return errCoffeeConflict
		}
		row.Set("selected", selected)
		row.Set("mastery", mastery)
		for _, record := range []*core.Record{row, clock, state} {
			if err = tx.Save(record); err != nil {
				return err
			}
		}
		collection, err := tx.FindCollectionByNameOrId("coffee_operations")
		if err != nil {
			return err
		}
		op := core.NewRecord(collection)
		op.Load(map[string]any{"user": owner, "request_key": body.RequestID, "payload": payload})
		return tx.Save(op)
	})
}

func registerCoffeeRoutes(e *core.ServeEvent) {
	e.Router.GET("/api/coffe/coffees", func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		user := sessionRecord(r)
		if user == nil {
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		snapshot, err := snapshotCoffees(r.App, user.Id, types.NowDateTime())
		if err != nil {
			return r.InternalServerError("Não foi possível carregar os cafés.", err)
		}
		return r.JSON(http.StatusOK, snapshot)
	})
	for _, action := range []string{"select", "serve", "recharge"} {
		e.Router.POST("/api/coffe/coffees/"+action, func(r *core.RequestEvent) error {
			r.Response.Header().Set("Cache-Control", "no-store")
			user := sessionRecord(r)
			if user == nil {
				return r.UnauthorizedError("Entre para jogar.", nil)
			}
			var body coffeeCommand
			if r.BindBody(&body) != nil {
				return r.BadRequestError("Pedido inválido.", nil)
			}
			return proxyRoomOperation(r, user.Id, "coffee_"+action, body)
		}).Bind(apis.BodyLimit(2048)).BindFunc(func(r *core.RequestEvent) error {
			if r.Request.Header.Get("Origin") == "" {
				return r.ForbiddenError("Origem inválida.", nil)
			}
			return sameOrigin(r)
		})
	}
}
