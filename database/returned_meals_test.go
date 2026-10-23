package main

import (
	"testing"

	"coffe-mania/database/playerstate"
	"coffe-mania/shared/gamewire"
	"coffe-mania/shared/recipecatalog"
	"github.com/pocketbase/pocketbase/core"
)

func TestReturnedMealPreservesRewardsAndStockAcrossRetries(t *testing.T) {
	app, owner := newCookingTestApp(t)
	food, err := counterForDish(app, owner, "nachos")
	if err != nil {
		t.Fatal(err)
	}
	food.Set("portions", 2)
	food.Set("experience", 6)
	food.Set("job_id", "test-batch")
	if err := app.Save(food); err != nil {
		t.Fatal(err)
	}
	consume := func(id string) {
		t.Helper()
		if err := app.RunInTransaction(func(tx core.App) error { return consumePortion(tx, owner, id) }); err != nil {
			t.Fatal(err)
		}
	}
	state := func() [3]int64 {
		t.Helper()
		s, e := app.FindFirstRecordByData(playerstate.Collection, "user", owner)
		if e != nil {
			t.Fatal(e)
		}
		return [3]int64{s.GetInt64("gold"), s.GetInt64("experience_current"), s.GetInt64("satisfaction_current_tenths")}
	}
	consume(food.Id)
	paid := state()
	meal := []gamewire.MealReturn{{CustomerID: "npc:customer", RecipeID: "nachos"}}
	if err := returnMeals(app, owner, meal); err != nil {
		t.Fatal(err)
	}
	food, err = app.FindRecordById("room_food", food.Id)
	if err != nil || food.GetInt("portions") != 2 || food.GetInt("prepaid_portions") != 1 || food.GetInt("experience") != 3 {
		t.Fatal("return did not restore stock and preserve XP pool", err)
	}
	if state() != paid {
		t.Fatal("return changed reward or popularity")
	}
	consume(food.Id)
	if state() != paid {
		t.Fatal("returned portion paid twice")
	}
	consume(food.Id)
	after := state()
	recipe, _ := recipecatalog.ByID("nachos")
	if after[0] != paid[0]+recipe.ProfitGold || after[1] != paid[1]+3 || after[2] != paid[2]+playerstate.SatisfiedCustomerTenths {
		t.Fatal("remaining normal portion lost its rewards")
	}
	// The receipt must survive consumption/deletion of the original food row.
	if err := returnMeals(app, owner, meal); err != nil {
		t.Fatal(err)
	}
	foods, err := app.FindRecordsByFilter("room_food", "user='"+owner+"'", "", 0, 0)
	if err != nil || len(foods) != 0 {
		t.Fatal("retry resurrected consumed refund", err)
	}
	// Returning the last portion recreates stock on an empty counter.
	if err := returnMeals(app, owner, []gamewire.MealReturn{{CustomerID: "npc:second", RecipeID: "nachos"}}); err != nil {
		t.Fatal(err)
	}
	foods, err = app.FindRecordsByFilter("room_food", "user='"+owner+"'", "", 0, 0)
	if err != nil || len(foods) != 1 || foods[0].GetString("counter") == "" || foods[0].GetInt("portions") != 1 {
		t.Fatal("last portion was not restored to a counter", err)
	}
	consume(foods[0].Id)
	if state() != after {
		t.Fatal("restored last portion generated rewards")
	}
}

func TestReturnedMealFullCountersKeepPortionAndInvalidBatchRollsBack(t *testing.T) {
	app, owner := newCookingTestApp(t)
	for {
		food, err := counterForDish(app, owner, "nachos")
		if err == errNoCounter {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		// Different recipes occupy all free counters.
		food.Set("recipe_id", "x_tudo")
		food.Set("portions", 2)
		food.Set("job_id", "test-batch:"+food.GetString("counter"))
		if err = app.Save(food); err != nil {
			t.Fatal(err)
		}
	}
	if err := returnMeals(app, owner, []gamewire.MealReturn{{CustomerID: "npc:full", RecipeID: "nachos"}}); err != nil {
		t.Fatal(err)
	}
	food, err := app.FindFirstRecordByFilter("room_food", "user='"+owner+"' && recipe_id='nachos'")
	if err != nil || food.GetInt("portions") != 1 || food.GetInt("prepaid_portions") != 1 {
		t.Fatal("full counters discarded portion", err)
	}
	if err := returnMeals(app, owner, []gamewire.MealReturn{{CustomerID: "npc:rollback", RecipeID: "nachos"}, {CustomerID: "human:invalid", RecipeID: "nachos"}}); err == nil {
		t.Fatal("invalid customer accepted")
	}
	receipts, err := app.FindRecordsByFilter("room_operations", "request_key='meal-return:npc:rollback'", "", 0, 0)
	if err != nil || len(receipts) != 0 {
		t.Fatal("failed batch left refund receipt", err)
	}
}
