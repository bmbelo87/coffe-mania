package main

import (
	"errors"
	"testing"
	"time"

	"coffe-mania/database/playerstate"
	"coffe-mania/shared/recipecatalog"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func TestRecipeLotsCookServeAndPay(t *testing.T) {
	app, owner := newCookingTestApp(t)
	stove, err := app.FindFirstRecordByData("player_stoves", "user", owner)
	if err != nil {
		t.Fatal(err)
	}
	ids := []string{"pamonha", "tacos_triplos", "vatapa", "mandioquinha", "arroz_carreteiro", "quindim", "salada_caesar", "bolo_cenoura", "super_a_la_minuta", "carre_carneiro", "torta_limao_vovo", "lagosta_nobre", "batatas_sorridentes", "salmao_alcaparras", "pimentao_recheado_chef", "banana_split"}
	for _, id := range ids {
		t.Run(id, func(t *testing.T) {
			recipe, ok := recipecatalog.Cookable(id)
			if !ok {
				t.Fatal("missing cookable recipe")
			}
			setCookingTestLevel(t, app, owner, recipe.Level)
			state, _ := app.FindFirstRecordByData(playerstate.Collection, "user", owner)
			state.Set("gold", 100000)
			if err := app.Save(state); err != nil {
				t.Fatal(err)
			}
			if err := startCooking(app, owner, stove.Id, id, types.NowDateTime()); err != nil {
				t.Fatal(err)
			}
			state, _ = app.FindFirstRecordByData(playerstate.Collection, "user", owner)
			if state.GetInt64("gold") != 100000-recipe.CostGold {
				t.Fatal("incorrect cost")
			}
			job, _ := app.FindFirstRecordByData("stove_cooking", "stove", stove.Id)
			if job.GetDateTime("ready_at").Time().Sub(job.GetDateTime("started_at").Time()) != time.Duration(recipe.DurationSeconds)*time.Second {
				t.Fatal("incorrect cooking duration")
			}
			finishJob(t, app, stove.Id)
			if err := serveCooking(app, owner, stove.Id, types.NowDateTime()); err != nil {
				t.Fatal(err)
			}
			food, err := app.FindFirstRecordByData("room_food", "user", owner)
			if err != nil || food.GetString("recipe_id") != id || food.GetInt("portions") != recipe.Portions || food.GetInt64("experience") != recipe.XP {
				t.Fatalf("incorrect served food: %v", err)
			}
			if err := app.RunInTransaction(func(tx core.App) error { return consumePortion(tx, owner, food.Id) }); err != nil {
				t.Fatal(err)
			}
			state, _ = app.FindFirstRecordByData(playerstate.Collection, "user", owner)
			if state.GetInt64("gold") != 100000-recipe.CostGold+recipe.ProfitGold {
				t.Fatal("incorrect per-portion sale")
			}
			food, _ = app.FindRecordById("room_food", food.Id)
			if food.GetInt("portions") != recipe.Portions-1 {
				t.Fatal("portion not consumed")
			}
			if err := app.Delete(food); err != nil {
				t.Fatal(err)
			}
			if err := cleanStove(app, owner, stove.Id); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestRecipeLevelRefusalDoesNotDebitOrCreateJob(t *testing.T) {
	app, owner := newCookingTestApp(t)
	stove, _ := app.FindFirstRecordByData("player_stoves", "user", owner)
	state, _ := app.FindFirstRecordByData(playerstate.Collection, "user", owner)
	gold := state.GetInt64("gold")
	if err := startCooking(app, owner, stove.Id, "banana_split", types.NowDateTime()); !errors.Is(err, errRecipeLevel) {
		t.Fatalf("expected level refusal, got %v", err)
	}
	state, _ = app.FindFirstRecordByData(playerstate.Collection, "user", owner)
	if state.GetInt64("gold") != gold {
		t.Fatal("locked recipe debited gold")
	}
	if _, err := app.FindFirstRecordByData("stove_cooking", "stove", stove.Id); err == nil {
		t.Fatal("locked recipe created a job")
	}
}
