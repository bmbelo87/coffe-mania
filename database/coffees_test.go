package main

import (
	"errors"
	"testing"
	"time"

	"coffe-mania/database/playerstate"
	"coffe-mania/shared/coffeecatalog"
	"coffe-mania/shared/roomcatalog"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func coffeeTestUnit(t *testing.T, app core.App, owner string) *core.Record {
	t.Helper()
	// The transaction tests can run before an art-only catalogue rebuild; no production file is changed.
	if _, exists := roomcatalog.ByID(coffeecatalog.MachineItemID); !exists {
		previous := roomcatalog.Items
		roomcatalog.Items = append(append([]roomcatalog.Item{}, previous...), roomcatalog.Item{
			ID: coffeecatalog.MachineItemID, Classname: "coffee_machine", Name: "Máquina de Café", Type: 3,
			Kind: "coffee_machine", Purchasable: true, SizeX: 1, SizeY: 1,
		})
		t.Cleanup(func() { roomcatalog.Items = previous })
	}
	collection, err := app.FindCollectionByNameOrId("player_inventory")
	if err != nil {
		t.Fatal(err)
	}
	unit := core.NewRecord(collection)
	unit.Load(map[string]any{"user": owner, "item_id": coffeecatalog.MachineItemID, "layer": "object", "placed": true, "tx": 6, "ty": 3, "rotation": 0})
	if err = app.Save(unit); err != nil {
		t.Fatal(err)
	}
	return unit
}

func coffeePlayerState(t *testing.T, app core.App, owner string) *core.Record {
	t.Helper()
	state, err := app.FindFirstRecordByData(playerstate.Collection, "user", owner)
	if err != nil {
		t.Fatal(err)
	}
	return state
}

func TestCoffeeSelectAndServeAreAtomic(t *testing.T) {
	app, owner := newCookingTestApp(t)
	unit := coffeeTestUnit(t, app, owner)
	now := types.NowDateTime()
	before := coffeePlayerState(t, app, owner)
	before.Set("satisfaction_current_tenths", 100)
	if err := app.Save(before); err != nil {
		t.Fatal(err)
	}
	public, err := publicCoffees(app, owner)
	if err != nil || len(public) != 1 || public[0].RecipeID != "espresso" || public[0].Stage != 1 {
		t.Fatalf("default coffee: %+v %v", public, err)
	}
	selection := coffeeCommand{MachineID: unit.Id, RecipeID: "descafeinado", RequestID: "select-coffee-000001"}
	if err = mutateCoffee(app, owner, "coffee_select", selection, now); err != nil {
		t.Fatal(err)
	}
	afterSelect := coffeePlayerState(t, app, owner)
	if afterSelect.GetInt64("energy_current") != before.GetInt64("energy_current") || afterSelect.GetInt64("gold") != before.GetInt64("gold") || afterSelect.GetInt64("cash") != before.GetInt64("cash") {
		t.Fatal("selecting a flavor spent resources")
	}
	nonce := "coffee-customer-000001"
	serve := coffeeCommand{MachineID: unit.Id, ActorID: "npc:coffee", CoffeeRequestID: nonce, RequestID: nonce}
	for i := 0; i < 2; i++ {
		if err = mutateCoffee(app, owner, "coffee_serve", serve, now); err != nil {
			t.Fatal(err)
		}
	}
	after := coffeePlayerState(t, app, owner)
	if after.GetInt64("energy_current") != before.GetInt64("energy_current")-2 || after.GetInt64("gold") != before.GetInt64("gold")+17 || after.GetInt64("experience_current") != before.GetInt64("experience_current")+1 || after.GetInt64("satisfaction_current_tenths") != 110 {
		t.Fatal("service debit/rewards are missing or duplicated")
	}
	row, err := coffeeRecord(app, owner)
	if err != nil {
		t.Fatal(err)
	}
	selected, mastery := coffeeData(row)
	if selected[unit.Id] != "descafeinado" || mastery["descafeinado"] != 1 {
		t.Fatal("selection/mastery was not persisted exactly once")
	}
	serve.ActorID = "npc:another"
	if !errors.Is(mutateCoffee(app, owner, "coffee_serve", serve, now), errCoffeeConflict) {
		t.Fatal("the same receipt paid for another actor")
	}
	selection.RecipeID, selection.RequestID = "cafe_com_leite", "select-coffee-000002"
	if err = mutateCoffee(app, owner, "coffee_select", selection, now); err != nil {
		t.Fatal("flavor could not change after service", err)
	}
	if coffeePlayerState(t, app, owner).GetInt64("energy_current") != after.GetInt64("energy_current") {
		t.Fatal("changing the selected flavor spent energy")
	}
}

func TestCoffeeLockedFlavorEnergyAndOwnershipRollback(t *testing.T) {
	app, owner := newCookingTestApp(t)
	unit := coffeeTestUnit(t, app, owner)
	now := types.NowDateTime()
	selection := coffeeCommand{MachineID: unit.Id, RecipeID: "cortado", RequestID: "select-coffee-000003"}
	if err := mutateCoffee(app, owner, "coffee_select", selection, now); err == nil {
		t.Fatal("locked medium flavor accepted")
	}
	snapshot, err := snapshotCoffees(app, owner, now)
	if err != nil || snapshot.Selected[unit.Id] != "espresso" || len(snapshot.Groups) != 1 || snapshot.Groups[0] != "basic" {
		t.Fatal("failed selection changed the default flavor/group", err)
	}
	state := coffeePlayerState(t, app, owner)
	state.Set("energy_current", 1)
	if err = app.Save(state); err != nil {
		t.Fatal(err)
	}
	nonce := "coffee-customer-000002"
	serve := coffeeCommand{MachineID: unit.Id, ActorID: "npc:coffee", CoffeeRequestID: nonce, RequestID: nonce}
	if err = mutateCoffee(app, owner, "coffee_serve", serve, now); err == nil {
		t.Fatal("coffee was served without enough energy")
	}
	after := coffeePlayerState(t, app, owner)
	if after.GetInt64("energy_current") != 1 || after.GetInt64("gold") != state.GetInt64("gold") {
		t.Fatal("refused service changed resources")
	}
	row, _ := coffeeRecord(app, owner)
	_, mastery := coffeeData(row)
	if mastery["espresso"] != 0 {
		t.Fatal("refused service granted mastery")
	}
	selection.RecipeID = "espresso"
	if !errors.Is(mutateCoffee(app, "foreign-owner", "coffee_select", selection, now), errRoomOwned) {
		t.Fatal("foreign machine accepted")
	}
	unit.Set("placed", false)
	if err = app.Save(unit); err != nil {
		t.Fatal(err)
	}
	if !errors.Is(mutateCoffee(app, owner, "coffee_select", selection, now), errRoomOwned) {
		t.Fatal("stored machine accepted")
	}
	unit.Set("placed", true)
	unit.Set("item_id", 9100001)
	if err = app.Save(unit); err != nil {
		t.Fatal(err)
	}
	if !errors.Is(mutateCoffee(app, owner, "coffee_select", selection, now), errRoomOwned) {
		t.Fatal("juice machine treated as coffee machine")
	}
}

func TestCoffeeSharesPersistentEnergyClockAndRecharge(t *testing.T) {
	app, owner := newCookingTestApp(t)
	unit := coffeeTestUnit(t, app, owner)
	now := types.NowDateTime()
	state := coffeePlayerState(t, app, owner)
	state.Set("energy_current", 25)
	clock, err := juiceRecord(app, owner, now)
	if err != nil {
		t.Fatal(err)
	}
	clock.Set("energy_at", now.Add(-10*time.Minute))
	for _, row := range []*core.Record{state, clock} {
		if err = app.Save(row); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 2; i++ {
		snapshot, snapshotErr := snapshotCoffees(app, owner, now)
		if snapshotErr != nil || snapshot.PlayerState.Energy.Current != 27 {
			t.Fatal("coffee regenerated energy incorrectly", snapshotErr)
		}
		juice, juiceErr := snapshotJuices(app, owner, now)
		if juiceErr != nil || juice.PlayerState.Energy.Current != 27 {
			t.Fatal("juice regenerated the same elapsed time twice", juiceErr)
		}
		if _, supplyErr := snapshotSupplies(app, owner, now); supplyErr != nil {
			t.Fatal(supplyErr)
		}
		if coffeePlayerState(t, app, owner).GetInt64("energy_current") != 27 {
			t.Fatal("supplies regenerated the same elapsed time twice")
		}
	}
	recharge := coffeeCommand{MachineID: unit.Id, RequestID: "recharge-coffee-0001"}
	beforeCash := coffeePlayerState(t, app, owner).GetInt64("cash")
	for i := 0; i < 2; i++ {
		if err = mutateCoffee(app, owner, "coffee_recharge", recharge, now); err != nil {
			t.Fatal(err)
		}
	}
	after := coffeePlayerState(t, app, owner)
	if after.GetInt64("energy_current") != after.GetInt64("energy_max") || after.GetInt64("cash") != beforeCash-coffeecatalog.RechargeCash {
		t.Fatal("recharge was missing or duplicated")
	}
	if err = app.ResetBootstrapState(); err != nil {
		t.Fatal(err)
	}
	if err = app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	afterReload, err := snapshotCoffees(app, owner, now)
	if err != nil || afterReload.PlayerState.Energy.Current != float64(after.GetInt64("energy_max")) || afterReload.Selected[unit.Id] != "espresso" {
		t.Fatal("coffee/energy did not survive database reload", err)
	}
}

func TestCoffeeMasteryCreatesOnePendingRewardWithoutInventingFurniture(t *testing.T) {
	app, owner := newCookingTestApp(t)
	unit := coffeeTestUnit(t, app, owner)
	now := types.NowDateTime()
	row, err := coffeeRecord(app, owner)
	if err != nil {
		t.Fatal(err)
	}
	mastery := map[string]int{}
	for _, recipe := range coffeecatalog.Recipes {
		if recipe.Group == "basic" {
			mastery[recipe.ID] = coffeecatalog.MasteryThresholds[2]
		}
	}
	mastery["espresso"]--
	row.Set("mastery", mastery)
	if err = app.Save(row); err != nil {
		t.Fatal(err)
	}
	beforeUnits, err := app.FindRecordsByFilter("player_inventory", "user={:user}", "", 0, 0, dbx.Params{"user": owner})
	if err != nil {
		t.Fatal(err)
	}
	for _, nonce := range []string{"coffee-customer-000003", "coffee-customer-000003", "coffee-customer-000004"} {
		serve := coffeeCommand{MachineID: unit.Id, ActorID: "npc:coffee", CoffeeRequestID: nonce, RequestID: nonce}
		if err = mutateCoffee(app, owner, "coffee_serve", serve, now); err != nil {
			t.Fatal(err)
		}
	}
	snapshot, err := snapshotCoffees(app, owner, now)
	if err != nil || snapshot.EvolutionStage != 2 || len(snapshot.Groups) != 2 || snapshot.Mastery["espresso"] != 101 {
		t.Fatal("mastery did not unlock medium/evolve exactly once", err)
	}
	receipts, err := app.FindRecordsByFilter("coffee_rewards", "user={:user} && recipe_id='espresso'", "", 0, 0, dbx.Params{"user": owner})
	if err != nil || len(receipts) != 1 || receipts[0].GetBool("delivered") || receipts[0].GetString("reward_name") != "Poster de Café" {
		t.Fatal("reward eligibility receipt was missing, duplicated or falsely delivered", err)
	}
	afterUnits, err := app.FindRecordsByFilter("player_inventory", "user={:user}", "", 0, 0, dbx.Params{"user": owner})
	if err != nil || len(afterUnits) != len(beforeUnits) {
		t.Fatal("an unverified reward item was inserted into inventory", err)
	}
	public, err := publicCoffees(app, owner)
	if err != nil || public[0].Stage != 2 {
		t.Fatal("visual stage not derived from durable mastery", err)
	}
}

func TestCoffeeMachineLimitCountsStoredUnits(t *testing.T) {
	app, owner := newCookingTestApp(t)
	unit := coffeeTestUnit(t, app, owner)
	unit.Set("placed", false)
	if err := app.Save(unit); err != nil {
		t.Fatal(err)
	}
	snapshot, err := snapshotRoom(app, owner)
	if err != nil {
		t.Fatal(err)
	}
	x, y, rotation := 5, 3, 0
	_, err = mutateRoom(app, owner, "purchase", roomCommand{ItemID: coffeecatalog.MachineItemID, TX: &x, TY: &y, Rotation: &rotation, Revision: &snapshot.Revision, RequestID: "purchase-coffee-00001"})
	if !errors.Is(err, errKitchenLimit) {
		t.Fatal("a stored machine bypassed the provisional ownership cap", err)
	}
}
