package main

import (
	"coffe-mania/database/appearance"
	"coffe-mania/shared/gamewire"
	"reflect"
	"testing"
)

func TestWaitersInitialHireLimitsAndIdempotency(t *testing.T) {
	app, owner := newCookingTestApp(t)
	initial, err := snapshotWaiters(app, owner)
	if err != nil || len(initial.Employees) != 1 || initial.Slots != 1 {
		t.Fatalf("initial staff: %+v %v", initial, err)
	}
	if err := hireWaiter(app, owner, "b"); err == nil {
		t.Fatal("hired beyond level capacity")
	}
	if err := hireWaiter(app, owner, "invented"); err == nil {
		t.Fatal("accepted unknown employee")
	}
	setCookingTestLevel(t, app, owner, 7)
	for range 2 {
		if err := hireWaiter(app, owner, "b"); err != nil {
			t.Fatal(err)
		}
	}
	state, err := snapshotWaiters(app, owner)
	if err != nil || len(state.Employees) != 2 || state.Slots != 2 {
		t.Fatalf("hire duplicated: %+v %v", state, err)
	}
	if err := hireWaiter(app, owner, "c"); err == nil {
		t.Fatal("capacity not enforced after hire")
	}
	world, err := publicWorld(app, owner)
	if err != nil || len(world.Employees) != 2 {
		t.Fatal("world missed durable roster", err)
	}
	waiter := gamewire.Actor{ID: "waiter:b", Kind: "waiter", X: 3, Y: 4, State: "waiter_delivery", WaiterCustomerID: "npc:customer", WaiterFoodID: "food"}
	if err := saveDormantRoom(app, owner, gamewire.Sleep{Waiters: []gamewire.Actor{waiter}}); err != nil {
		t.Fatal(err)
	}
	room, _ := app.FindFirstRecordByData("player_rooms", "user", owner)
	var saved []gamewire.Actor
	_ = room.UnmarshalJSONField("waiter_actors", &saved)
	if len(saved) != 1 || saved[0].X != 3 || saved[0].WaiterFoodID != "food" {
		t.Fatal("dormancy lost staff position/task")
	}
	if err := saveDormantRoom(app, owner, gamewire.Sleep{Waiters: []gamewire.Actor{{ID: "waiter:forged", Kind: "waiter"}}}); err == nil {
		t.Fatal("saved employee not in roster")
	}
}

func TestExistingLocalEmployeesReceiveTheSameFaceAsTheirCandidate(t *testing.T) {
	app, owner := newCookingTestApp(t)
	room, err := app.FindFirstRecordByData("player_rooms", "user", owner)
	if err != nil {
		t.Fatal(err)
	}
	room.Set("employees", []gamewire.Employee{{ID: "a", Name: "André", Appearance: appearance.Initial()}, {ID: "b", Name: "Bia", Appearance: appearance.Initial()}})
	if err := app.Save(room); err != nil {
		t.Fatal(err)
	}
	first, err := snapshotWaiters(app, owner)
	if err != nil {
		t.Fatal(err)
	}
	again, err := snapshotWaiters(app, owner)
	if err != nil || !reflect.DeepEqual(first, again) {
		t.Fatal("employee faces changed on refresh", err)
	}
	for i, employee := range first.Employees {
		if employee.ID != first.Candidates[i].ID || employee.Appearance != first.Candidates[i].Appearance {
			t.Fatal("hired employee differs from selection portrait")
		}
	}
	if first.Employees[0].Appearance == first.Employees[1].Appearance {
		t.Fatal("existing employees retained identical faces")
	}
	if err := saveDormantRoom(app, owner, gamewire.Sleep{}); err != nil {
		t.Fatal(err)
	}
	room, _ = app.FindFirstRecordByData("player_rooms", "user", owner)
	var saved []gamewire.Employee
	_ = room.UnmarshalJSONField("employees", &saved)
	if !reflect.DeepEqual(saved, first.Employees) {
		t.Fatal("dormancy did not persist the updated faces")
	}
}
