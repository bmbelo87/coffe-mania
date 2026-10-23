package gameruntime

import (
	"context"
	"testing"
	"time"

	"coffe-mania/shared/gamewire"
)

type waiterStore struct {
	Storage
	consumed int
}

func (s *waiterStore) Consume(context.Context, string, string) (gamewire.Business, error) {
	s.consumed++
	return gamewire.Business{Level: 1, Popularity: 801}, nil
}
func waiterRoom(t *testing.T) (*room, *entity, *entity, *waiterStore) {
	t.Helper()
	units := []gamewire.Unit{
		{ID: "counter", ItemID: 3020069, Placed: true, X: 2, Y: 2},
		{ID: "table", ItemID: 3030010, Placed: true, X: 6, Y: 5},
	}
	r, _ := stuckRoom(units)
	store := &waiterStore{}
	r.manager.store = store
	r.world.Employees = []gamewire.Employee{{ID: "a", Name: "André"}}
	r.world.Foods = []gamewire.Food{{ID: "food", Counter: "counter", Recipe: "nachos", Portions: 2}}
	now := time.Now()
	waiter := addNPC(r, "waiter:a", 1, 2, now)
	waiter.Kind, waiter.State = "waiter", "waiter_idle"
	customer := addNPC(r, "npc:customer", 6, 6, now.Add(time.Hour))
	customer.State, customer.TableID = "seated", "table"
	return r, waiter, customer, store
}
func TestWaiterWalksWithDishAndConsumesOnlyAtDelivery(t *testing.T) {
	r, w, c, store := waiterRoom(t)
	now := time.Now()
	r.advanceWaiter(w, now)
	if w.State != "waiter_delivery" || w.Food == nil || c.State != "seated" || store.consumed != 0 {
		t.Fatalf("pickup charged or failed: %+v", w)
	}
	r.advanceWaiter(w, now)
	if w.Move == nil || store.consumed != 0 {
		t.Fatal("delivery must walk before charging")
	}
	for i := 1; i < 200 && c.State != "eating"; i++ {
		r.tick(now.Add(time.Duration(i) * r.manager.options.Tick))
	}
	if c.State != "eating" || store.consumed != 1 || r.world.Foods[0].Portions != 1 {
		t.Fatalf("delivery: %s, %d charges", c.State, store.consumed)
	}
	r.advanceWaiter(w, now.Add(time.Minute))
	if store.consumed != 1 {
		t.Fatal("same meal paid twice")
	}
}
func TestTrappedWaiterDeliversInstantlyThroughSolidEnclosure(t *testing.T) {
	r, w, c, store := waiterRoom(t)
	now := time.Now()
	for y := 1; y < 8; y++ {
		r.grid.add(gamewire.Unit{ID: "barrier", ItemID: 3030010, Placed: true, X: 3, Y: y})
	}
	r.advanceWaiter(w, now)
	if w.Move != nil || w.X != 1 || c.State != "eating" || store.consumed != 1 {
		t.Fatalf("trapped shortcut did not deliver: %+v", w)
	}
	r.advanceWaiter(w, now.Add(time.Second))
	if store.consumed != 1 {
		t.Fatal("instant service duplicated a portion")
	}
}
func TestWaiterDoesNotTeleportForActorsAndReservationsAreExclusive(t *testing.T) {
	r, w, c, store := waiterRoom(t)
	now := time.Now()
	// A geometry-valid aisle to the counter, blocked only by another avatar.
	w.X, w.Y = 1, 1
	r.indexActor(w)
	r.grid.add(gamewire.Unit{ID: "wall", ItemID: 3030010, Placed: true, X: 1, Y: 2})
	blocker := addNPC(r, "human:blocker", 2, 1, now.Add(time.Hour))
	blocker.Kind = "human"
	r.advanceWaiter(w, now)
	if store.consumed != 0 || c.State != "seated" {
		t.Fatal("actor triggered instant delivery")
	}
	other := addNPC(r, "waiter:b", 4, 1, now)
	other.Kind, other.State = "waiter", "waiter_idle"
	r.advanceWaiter(other, now)
	if other.WaiterCustomerID != "" {
		t.Fatal("two waiters reserved the same customer")
	}
}
func TestEmployeeRosterRestoresPositionAndUnpaidTask(t *testing.T) {
	r, w, c, store := waiterRoom(t)
	r.advanceWaiter(w, time.Now())
	saved := w.Actor
	saved.Path = nil
	r.unindexActor(w.ID)
	delete(r.actors, w.ID)
	r.syncWaiters([]gamewire.Actor{saved}, time.Now())
	restored := r.actors[w.ID]
	if restored == nil || restored.X != saved.X || restored.Y != saved.Y || restored.WaiterCustomerID != c.ID || store.consumed != 0 {
		t.Fatal("sleep restore lost reservation or charged pickup")
	}
}

func TestWaiterAppearanceUpdatePreservesPositionAndTask(t *testing.T) {
	r, w, c, _ := waiterRoom(t)
	w.Appearance = "old-face"
	w.WaiterCustomerID = c.ID
	w.WaiterFoodID = "food"
	r.world.Employees[0].Appearance = "new-face"
	r.syncWaiters(nil, time.Now())
	if r.actors[w.ID] != w || w.X != 1 || w.Y != 2 || w.WaiterCustomerID != c.ID || w.WaiterFoodID != "food" || w.Appearance != "new-face" {
		t.Fatal("cosmetic update reset the waiter simulation")
	}
}

func TestWaiterCollectsFromEverySideForEveryRotation(t *testing.T) {
	for rotation := 0; rotation < 4; rotation++ {
		for _, side := range neighbours[:4] {
			r, w, _, store := waiterRoom(t)
			u := r.world.Units[0]
			r.grid.remove(u)
			u.Rotation = rotation
			r.world.Units[0] = u
			r.grid.add(u)
			w.X, w.Y = u.X+side.X, u.Y+side.Y
			r.indexActor(w)
			r.advanceWaiter(w, time.Now())
			if w.State != "waiter_delivery" || w.Food == nil || w.Move != nil || store.consumed != 0 {
				t.Fatalf("rotation %d, side %+v: walked around instead of collecting: %+v", rotation, side, w)
			}
		}
	}
}

func TestWaiterChoosesFreeCounterEdgeInsteadOfOccupiedShortestEdge(t *testing.T) {
	r, w, _, store := waiterRoom(t)
	w.X, w.Y = 1, 1
	r.indexActor(w)
	for i, tile := range []Tile{{X: 2, Y: 1}, {X: 1, Y: 2}} {
		blocker := addNPC(r, string(rune('a'+i)), tile.X, tile.Y, time.Now().Add(time.Hour))
		blocker.Kind = "human"
	}
	// Both adjacent exits are occupied: geometry must remain reachable for the
	// actor-waiting fallback, without enabling instant delivery.
	path := r.waiterPath(w, "counter")
	if path == nil || len(path) == 0 {
		t.Fatal("missing geometry fallback")
	}
	// Open an approach around the north blocker, keeping the west edge occupied.
	r.unindexActor("a")
	delete(r.actors, "a")
	path = r.waiterPath(w, "counter")
	if len(path) == 0 || path[len(path)-1] != (Tile{X: 2, Y: 1}) {
		t.Fatalf("did not choose free edge: %+v", path)
	}
	r.advanceWaiter(w, time.Now())
	if w.Move == nil || store.consumed != 0 {
		t.Fatal("free approach must walk without charging")
	}
}
