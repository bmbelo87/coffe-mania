package gameruntime

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"coffe-mania/shared/gamewire"
)

type decorationStore struct {
	*waiterStore
	world    gamewire.World
	returned []gamewire.MealReturn
	fail     bool
}

func (s *decorationStore) Operate(_ context.Context, op gamewire.Operation) (gamewire.Result, error) {
	if s.fail {
		return gamewire.Result{}, errors.New("offline")
	}
	if op.Action != "return_meals" {
		return gamewire.Result{}, errors.New("unexpected operation")
	}
	if err := json.Unmarshal(op.Body, &s.returned); err != nil {
		return gamewire.Result{}, err
	}
	s.world.Foods[0].Portions += len(s.returned)
	return gamewire.Result{Status: 200, World: &s.world}, nil
}
func TestDecorationReleasesCustomersReturnsMealsAndResetsWaiter(t *testing.T) {
	r, w, c, store := waiterRoom(t)
	r.id = "owner"
	db := &decorationStore{waiterStore: store, world: r.world}
	r.manager.store = db
	owner := addNPC(r, "human:owner", 1, 1, time.Now())
	owner.Kind = "human"
	c.State, c.Ate, c.ChairID = "eating", true, "chair"
	c.Food = &gamewire.Food{Recipe: "nachos"}
	r.seats[c.ChairID] = c.ID
	w.WaiterCustomerID, w.WaiterFoodID = c.ID, "food"
	w.State, w.Food = "waiter_delivery", &gamewire.Food{Recipe: "nachos"}
	other := addNPC(r, "npc:waiting", 6, 4, time.Now())
	other.TableID = "table"
	if message := r.prepareTableEdit(owner, "table"); message != "" {
		t.Fatal(message)
	}
	if r.actors[c.ID] != nil || r.actors[other.ID] != nil || len(r.seats) != 0 || len(r.actorTiles[c.ID]) != 0 {
		t.Fatal("customers still reserve the table")
	}
	if len(db.returned) != 1 || db.returned[0].CustomerID != c.ID || r.world.Foods[0].Portions != 3 {
		t.Fatal("meal not returned exactly once")
	}
	if c.Judged || other.Judged || c.Emotion != nil || w.WaiterCustomerID != "" || w.Food != nil {
		t.Fatal("removal judged customer or retained delivery")
	}
	if !r.tableBeingEdited("table") {
		t.Fatal("held table was not claimed")
	}
	if message := r.prepareTableEdit(owner, "table"); message != "" || len(db.returned) != 1 {
		t.Fatal("repeat selection duplicated refund")
	}
	r.prepareTableEdit(owner, "")
	if r.tableBeingEdited("table") {
		t.Fatal("cancel retained claim")
	}
}
func TestDecorationRefundFailureAndHumanOccupantPreserveCustomer(t *testing.T) {
	r, _, c, store := waiterRoom(t)
	db := &decorationStore{waiterStore: store, world: r.world, fail: true}
	r.manager.store = db
	owner := &entity{}
	c.State, c.Food = "eating", &gamewire.Food{Recipe: "nachos"}
	if r.prepareTableEdit(owner, "table") == "" || r.actors[c.ID] == nil || c.Food == nil || owner.editingTable != "" {
		t.Fatal("failed refund removed customer")
	}
	c.Kind = "human"
	db.fail = false
	if r.prepareTableEdit(owner, "table") == "" || r.actors[c.ID] == nil || len(db.returned) != 0 {
		t.Fatal("human occupant was removed")
	}
}
func TestDecorationTableCommandOwnerOnlyAndWorksWhileChefBusy(t *testing.T) {
	r, _, c, _ := waiterRoom(t)
	r.id = "owner"
	owner := addNPC(r, "human:owner", 1, 1, time.Now().Add(time.Hour))
	owner.Kind, owner.State = "human", "serving"
	p := &Peer{Ticket: gamewire.Ticket{User: "owner"}, Out: make(chan []byte, 8)}
	r.command(p, gamewire.Command{Type: "edit_table", UnitID: "table"})
	var event gamewire.Event
	_ = json.Unmarshal(<-p.Out, &event)
	if event.Type != "ack" || r.actors[c.ID] == nil || !r.tableBeingEdited("table") {
		t.Fatal("busy chef could not decorate")
	}
	guest := addNPC(r, "human:guest", 2, 1, time.Now())
	guest.Kind = "human"
	p.Ticket.User = "guest"
	r.command(p, gamewire.Command{Type: "edit_table", UnitID: "table"})
	_ = json.Unmarshal(<-p.Out, &event)
	if event.Type != "error" || guest.editingTable != "" {
		t.Fatal("guest claimed table")
	}
}
func TestDecorationHeldTableCannotBeReservedUntilCancel(t *testing.T) {
	units := []gamewire.Unit{{ID: "table", ItemID: 3030010, Placed: true, X: 5, Y: 4}, {ID: "chair", ItemID: 3040001, Placed: true, X: 4, Y: 4, Rotation: 0}}
	r, _ := stuckRoom(units)
	owner := addNPC(r, "human:owner", 1, 1, time.Now())
	owner.Kind = "human"
	c := addNPC(r, "npc:waiting", 3, 4, time.Now())
	if r.prepareTableEdit(owner, "table") != "" {
		t.Fatal("claim failed")
	}
	if r.reserveChair(c, "chair", time.Now()) || r.seats["chair"] != "" || c.TableID != "" {
		t.Fatal("customer reserved held table")
	}
	r.prepareTableEdit(owner, "")
	if !r.reserveChair(c, "chair", time.Now()) {
		t.Fatal("cancel did not release table")
	}
}

func TestSidewalkRoutesUseAllEndpointsWithoutCuttingAcrossScenery(t *testing.T) {
	r, _ := stuckRoom(nil)
	for _, turn := range []Tile{{X: -1, Y: 4}, {X: 4, Y: -1}} {
		for side := 0; side < 3; side++ {
			end := r.streetEndpoint(side)
			for _, pair := range [][2]Tile{{turn, end}, {end, turn}} {
				previous := pair[0]
				for _, tile := range streetLine(pair[0], pair[1]) {
					if tile.X != -1 && tile.Y != -1 {
						t.Fatalf("route cut across scenery: %v -> %v at %v", pair[0], pair[1], tile)
					}
					if abs(tile.X-previous.X)+abs(tile.Y-previous.Y) != 1 {
						t.Fatalf("non-contiguous route: %v -> %v", previous, tile)
					}
					previous = tile
				}
				if previous != pair[1] {
					t.Fatal("route missed endpoint")
				}
			}
		}
	}
}
