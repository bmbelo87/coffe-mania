package main

import (
	"coffe-mania/database/playerstate"
	"errors"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	"testing"
	"time"
)

func juiceTestUnit(t *testing.T, app core.App, owner string) *core.Record {
	t.Helper()
	collection, err := app.FindCollectionByNameOrId("player_inventory")
	if err != nil {
		t.Fatal(err)
	}
	unit := core.NewRecord(collection)
	unit.Load(map[string]any{"user": owner, "item_id": 9100001, "layer": "object", "placed": true, "tx": 6, "ty": 3, "rotation": 0})
	if err = app.Save(unit); err != nil {
		t.Fatal(err)
	}
	return unit
}
func juiceStateForTest(t *testing.T, app core.App, owner string) *core.Record {
	t.Helper()
	state, err := app.FindFirstRecordByData(playerstate.Collection, "user", owner)
	if err != nil {
		t.Fatal(err)
	}
	return state
}
func TestJuiceUnlockPrepareServeIsAtomic(t *testing.T) {
	app, owner := newCookingTestApp(t)
	unit := juiceTestUnit(t, app, owner)
	now := types.NowDateTime()
	body := juiceCommand{MachineID: unit.Id, RecipeID: "orange", RequestID: "prepare-00000000001"}
	if mutateJuice(app, owner, "juice_prepare", body, now) == nil {
		t.Fatal("locked machine prepared juice")
	}
	unlock := juiceCommand{MachineID: unit.Id, RequestID: "unlock-00000000001"}
	if err := mutateJuice(app, owner, "juice_unlock", unlock, now); err != nil {
		t.Fatal(err)
	}
	if err := mutateJuice(app, owner, "juice_unlock", unlock, now); err != nil {
		t.Fatal(err)
	}
	if cash := juiceStateForTest(t, app, owner).GetInt64("cash"); cash != 980 {
		t.Fatalf("unlock cash %d", cash)
	}
	if err := mutateJuice(app, owner, "juice_prepare", body, now); err != nil {
		t.Fatal(err)
	}
	if err := mutateJuice(app, owner, "juice_prepare", body, now); err != nil {
		t.Fatal(err)
	}
	before := juiceStateForTest(t, app, owner)
	if before.GetInt64("energy_current") != 41 {
		t.Fatalf("prepare energy %d", before.GetInt64("energy_current"))
	}
	stock, err := publicJuices(app, owner)
	if err != nil || len(stock) != 1 || stock[0].Portions != 5 {
		t.Fatalf("stock %+v, %v", stock, err)
	}
	request := "customer-0000000001"
	serve := juiceCommand{MachineID: unit.Id, ActorID: "npc:customer", RequestID: request, JuiceRequestID: request}
	for i := 0; i < 2; i++ {
		if err = mutateJuice(app, owner, "juice_serve", serve, now); err != nil {
			t.Fatal(err)
		}
	}
	after := juiceStateForTest(t, app, owner)
	if after.GetInt64("gold") != before.GetInt64("gold")+24 {
		t.Fatal("serve gold duplicated or missing")
	}
	if after.GetInt64("experience_current") != before.GetInt64("experience_current")+2 {
		t.Fatal("serve XP duplicated or missing")
	}
	if after.GetInt64("satisfaction_current_tenths") != before.GetInt64("satisfaction_current_tenths")+12 {
		t.Fatal("serve popularity duplicated or missing")
	}
	row, _ := app.FindFirstRecordByData("juice_state", "user", owner)
	batches, mastery := juiceData(row)
	if batches[unit.Id].Portions != 4 || mastery["orange"] != 1 {
		t.Fatal("serve stock/mastery duplicated")
	}
	serve.ActorID = "npc:another"
	if !errors.Is(mutateJuice(app, owner, "juice_serve", serve, now), errJuiceConflict) {
		t.Fatal("request key reused for a different customer")
	}
}
func TestJuiceInsufficientEnergyAndOwnershipRollBack(t *testing.T) {
	app, owner := newCookingTestApp(t)
	unit := juiceTestUnit(t, app, owner)
	now := types.NowDateTime()
	if err := mutateJuice(app, owner, "juice_unlock", juiceCommand{MachineID: unit.Id, RequestID: "unlock-00000000002"}, now); err != nil {
		t.Fatal(err)
	}
	state := juiceStateForTest(t, app, owner)
	state.Set("energy_current", 1)
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	body := juiceCommand{MachineID: unit.Id, RecipeID: "orange", RequestID: "prepare-00000000002"}
	if mutateJuice(app, owner, "juice_prepare", body, now) == nil {
		t.Fatal("prepared without energy")
	}
	row, _ := app.FindFirstRecordByData("juice_state", "user", owner)
	stock, _ := juiceData(row)
	if stock[unit.Id].Portions != 0 || juiceStateForTest(t, app, owner).GetInt64("energy_current") != 1 {
		t.Fatal("failed preparation mutated stock/energy")
	}
	if !errors.Is(mutateJuice(app, "another-owner", "juice_prepare", body, now), errRoomOwned) {
		t.Fatal("foreign machine accepted")
	}
	unit.Set("placed", false)
	if err := app.Save(unit); err != nil {
		t.Fatal(err)
	}
	if !errors.Is(mutateJuice(app, owner, "juice_prepare", body, now), errRoomOwned) {
		t.Fatal("stored machine accepted")
	}
}
func TestJuiceRegenerationAndRechargeArePersistent(t *testing.T) {
	app, owner := newCookingTestApp(t)
	unit := juiceTestUnit(t, app, owner)
	now := types.NowDateTime()
	row, err := juiceRecord(app, owner, now)
	if err != nil {
		t.Fatal(err)
	}
	state := juiceStateForTest(t, app, owner)
	state.Set("energy_current", 25)
	row.Set("energy_at", now.Add(-10*time.Minute))
	if err = app.Save(state); err != nil {
		t.Fatal(err)
	}
	if err = app.Save(row); err != nil {
		t.Fatal(err)
	}
	snapshot, err := snapshotJuices(app, owner, now)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.PlayerState.Energy.Current != 27 {
		t.Fatal("energy regeneration wrong")
	}
	snapshot, err = snapshotJuices(app, owner, now)
	if err != nil || snapshot.PlayerState.Energy.Current != 27 {
		t.Fatal("regeneration duplicated")
	}
	recharge := juiceCommand{MachineID: unit.Id, RequestID: "recharge-000000001"}
	for i := 0; i < 2; i++ {
		if err = mutateJuice(app, owner, "juice_recharge", recharge, now); err != nil {
			t.Fatal(err)
		}
	}
	state = juiceStateForTest(t, app, owner)
	if state.GetInt64("cash") != 996 || state.GetInt64("energy_current") != 50 {
		t.Fatal("recharge duplicated or not persisted")
	}
}
