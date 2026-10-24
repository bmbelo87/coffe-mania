package main

import (
	"errors"
	"testing"
	"time"

	"coffe-mania/database/playerstate"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func supplyState(t *testing.T, app core.App, owner string) *core.Record {
	t.Helper()
	state, err := playerstate.GetOrCreate(app, owner)
	if err != nil {
		t.Fatal(err)
	}
	return state
}

func setSupplyState(t *testing.T, app core.App, owner string, values map[string]any) {
	t.Helper()
	state := supplyState(t, app, owner)
	for key, value := range values {
		state.Set(key, value)
	}
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
}

func onlySupplyOrder(t *testing.T, app core.App, owner string, now types.DateTime) supplyOrder {
	t.Helper()
	snapshot, err := snapshotSupplies(app, owner, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Orders) != 1 {
		t.Fatalf("orders %d", len(snapshot.Orders))
	}
	return snapshot.Orders[0]
}

func TestSupplyOrderDebitsGoldOnceAndFillsSlotsInOrder(t *testing.T) {
	app, owner := newCookingTestApp(t)
	setSupplyState(t, app, owner, map[string]any{"gold": 8000})
	now := types.NowDateTime()
	first := supplyCommand{Kind: "express", RequestID: "supply-order-000001"}
	for range 2 {
		if err := mutateSupplies(app, owner, "order", first, now); err != nil {
			t.Fatal(err)
		}
	}
	if gold := supplyState(t, app, owner).GetInt64("gold"); gold != 5000 {
		t.Fatalf("gold after repeated request %d", gold)
	}
	order := onlySupplyOrder(t, app, owner, now)
	if order.Slot != 0 || order.Quantity != 4 || order.ArrivesAt != now.Add(10*time.Minute).Time().UnixMilli() {
		t.Fatalf("order %+v", order)
	}
	reused := supplyCommand{Kind: "media", RequestID: first.RequestID}
	if err := mutateSupplies(app, owner, "order", reused, now); !errors.Is(err, errSupplyConflict) {
		t.Fatalf("reused key: %v", err)
	}
	if err := mutateSupplies(app, owner, "order", supplyCommand{Kind: "media", RequestID: "supply-order-000002"}, now); !errors.Is(err, errSupplyLevel) {
		t.Fatalf("level gate: %v", err)
	}
	if err := mutateSupplies(app, owner, "order", supplyCommand{Kind: "express", RequestID: "supply-order-000003"}, now); err != nil {
		t.Fatal(err)
	}
	if err := mutateSupplies(app, owner, "order", supplyCommand{Kind: "express", RequestID: "supply-order-000004"}, now); !errors.Is(err, errSupplyGold) {
		t.Fatalf("gold check: %v", err)
	}
}

func TestSupplyPlatformHasFourSlots(t *testing.T) {
	app, owner := newCookingTestApp(t)
	setSupplyState(t, app, owner, map[string]any{"gold": 100000})
	now := types.NowDateTime()
	for index, key := range []string{"slot-request-0000001", "slot-request-0000002", "slot-request-0000003", "slot-request-0000004"} {
		if err := mutateSupplies(app, owner, "order", supplyCommand{Kind: "express", RequestID: key}, now); err != nil {
			t.Fatalf("order %d: %v", index, err)
		}
	}
	if err := mutateSupplies(app, owner, "order", supplyCommand{Kind: "express", RequestID: "slot-request-0000005"}, now); !errors.Is(err, errSupplySlotsFull) {
		t.Fatalf("fifth order: %v", err)
	}
	if gold := supplyState(t, app, owner).GetInt64("gold"); gold != 100000-4*3000 {
		t.Fatalf("a refused order was charged: %d", gold)
	}
}

func TestSupplyCollectSpendsEnergyAndKeepsWhatDoesNotFit(t *testing.T) {
	app, owner := newCookingTestApp(t)
	setSupplyState(t, app, owner, map[string]any{"gold": 30000, "level": 2, "crates_current": 0, "crates_max": 10, "energy_current": 5})
	now := types.NowDateTime()
	if err := mutateSupplies(app, owner, "order", supplyCommand{Kind: "media", RequestID: "collect-order-00001"}, now); err != nil {
		t.Fatal(err)
	}
	order := onlySupplyOrder(t, app, owner, now)
	collect := supplyCommand{OrderID: order.ID, RequestID: "collect-early-00001"}
	if err := mutateSupplies(app, owner, "collect", collect, now); !errors.Is(err, errSupplyNotYet) {
		t.Fatalf("collected on the way: %v", err)
	}
	later := now.Add(2*time.Hour + time.Second)
	collect.RequestID = "collect-first-00001"
	for range 2 {
		if err := mutateSupplies(app, owner, "collect", collect, later); err != nil {
			t.Fatal(err)
		}
	}
	// Two hours of waiting regenerate 30 energy (one every 4 minutes) before the collection.
	state := supplyState(t, app, owner)
	if state.GetInt64("crates_current") != 10 || state.GetInt64("energy_current") != 34 {
		t.Fatalf("crates %d energy %d", state.GetInt64("crates_current"), state.GetInt64("energy_current"))
	}
	if left := onlySupplyOrder(t, app, owner, later); left.Quantity != 5 {
		t.Fatalf("box keeps the rest: %d", left.Quantity)
	}
	if err := mutateSupplies(app, owner, "collect", supplyCommand{OrderID: order.ID, RequestID: "collect-full-000001"}, later); !errors.Is(err, errSupplyPantry) {
		t.Fatalf("full pantry: %v", err)
	}
	if energy := supplyState(t, app, owner).GetInt64("energy_current"); energy != 34 {
		t.Fatalf("a refused collection spent energy: %d", energy)
	}
	setSupplyState(t, app, owner, map[string]any{"crates_current": 0, "energy_current": 0})
	if err := mutateSupplies(app, owner, "collect", supplyCommand{OrderID: order.ID, RequestID: "collect-tired-00001"}, later); !errors.Is(err, errSupplyEnergy) {
		t.Fatalf("no energy: %v", err)
	}
	setSupplyState(t, app, owner, map[string]any{"energy_current": 1})
	if err := mutateSupplies(app, owner, "collect", supplyCommand{OrderID: order.ID, RequestID: "collect-last-000001"}, later); err != nil {
		t.Fatal(err)
	}
	snapshot, err := snapshotSupplies(app, owner, later)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Orders) != 0 || snapshot.PlayerState.Crates.Current != 5 {
		t.Fatalf("emptied box stays: %+v", snapshot)
	}
}

func TestSupplyRushSpoilSaveAndDiscard(t *testing.T) {
	app, owner := newCookingTestApp(t)
	setSupplyState(t, app, owner, map[string]any{"gold": 10000, "cash": 3, "crates_current": 0})
	now := types.NowDateTime()
	if err := mutateSupplies(app, owner, "order", supplyCommand{Kind: "express", RequestID: "rush-order-00000001"}, now); err != nil {
		t.Fatal(err)
	}
	order := onlySupplyOrder(t, app, owner, now)
	if err := mutateSupplies(app, owner, "save", supplyCommand{OrderID: order.ID, RequestID: "rush-save-early-001"}, now); !errors.Is(err, errSupplyFresh) {
		t.Fatalf("saved a fresh box: %v", err)
	}
	if err := mutateSupplies(app, owner, "rush", supplyCommand{OrderID: order.ID, RequestID: "rush-now-000000001"}, now); err != nil {
		t.Fatal(err)
	}
	if cash := supplyState(t, app, owner).GetInt64("cash"); cash != 2 {
		t.Fatalf("rush cash %d", cash)
	}
	if err := mutateSupplies(app, owner, "rush", supplyCommand{OrderID: order.ID, RequestID: "rush-again-0000001"}, now); !errors.Is(err, errSupplyArrived) {
		t.Fatalf("rushed an arrived box: %v", err)
	}
	spoiled := now.Add(supplyShelfLife + time.Second)
	if err := mutateSupplies(app, owner, "collect", supplyCommand{OrderID: order.ID, RequestID: "rush-collect-00001"}, spoiled); !errors.Is(err, errSupplySpoiled) {
		t.Fatalf("collected a spoiled box: %v", err)
	}
	if err := mutateSupplies(app, owner, "save", supplyCommand{OrderID: order.ID, RequestID: "rush-save-00000001"}, spoiled); err != nil {
		t.Fatal(err)
	}
	saved := onlySupplyOrder(t, app, owner, spoiled)
	if saved.ArrivesAt != spoiled.Time().UnixMilli() || supplyState(t, app, owner).GetInt64("cash") != 1 {
		t.Fatalf("save %+v", saved)
	}
	again := spoiled.Add(supplyShelfLife + time.Second)
	if err := mutateSupplies(app, owner, "discard", supplyCommand{OrderID: order.ID, RequestID: "rush-discard-00001"}, again); err != nil {
		t.Fatal(err)
	}
	snapshot, err := snapshotSupplies(app, owner, again)
	if err != nil || len(snapshot.Orders) != 0 {
		t.Fatalf("discard %v %+v", err, snapshot.Orders)
	}
}

func TestSupplyOrdersBelongToTheirOwner(t *testing.T) {
	app, owner := newCookingTestApp(t)
	setSupplyState(t, app, owner, map[string]any{"gold": 10000})
	now := types.NowDateTime()
	if err := mutateSupplies(app, owner, "order", supplyCommand{Kind: "express", RequestID: "owner-order-0000001"}, now); err != nil {
		t.Fatal(err)
	}
	order := onlySupplyOrder(t, app, owner, now)
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	other := core.NewRecord(users)
	other.SetEmail("outro@local.mail")
	other.SetPassword("12345678")
	if err = app.Save(other); err != nil {
		t.Fatal(err)
	}
	if _, err = playerstate.GetOrCreate(app, other.Id); err != nil {
		t.Fatal(err)
	}
	if err := mutateSupplies(app, other.Id, "rush", supplyCommand{OrderID: order.ID, RequestID: "owner-rush-00000001"}, now); !errors.Is(err, errSupplyUnknown) {
		t.Fatalf("another player rushed the order: %v", err)
	}
}
