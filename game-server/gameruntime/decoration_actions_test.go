package gameruntime

import (
	"coffe-mania/shared/gamewire"
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

type decorationMutationStore struct {
	Storage
	seed   gamewire.Seed
	result gamewire.Result
	saved  gamewire.Sleep
}

func (s *decorationMutationStore) Load(context.Context, string) (gamewire.Seed, error) {
	return s.seed, nil
}
func (s *decorationMutationStore) Operate(context.Context, gamewire.Operation) (gamewire.Result, error) {
	return s.result, nil
}
func (s *decorationMutationStore) Active(context.Context, string, int) error { return nil }
func (s *decorationMutationStore) Sleep(_ context.Context, _ string, state gamewire.Sleep) error {
	s.saved = state
	return nil
}

func TestDecorationFailedPersistenceOrGuestCannotDetachCustomer(t *testing.T) {
	for _, status := range []int{200, 409, 500} {
		for _, guest := range []bool{false, true} {
			t.Run(fmt.Sprintf("%d/guest=%v", status, guest), func(t *testing.T) {
				world := gamewire.World{RoomID: "owner", TilesX: 8, TilesY: 8, Units: []gamewire.Unit{{ID: "table", ItemID: 3030010, Placed: true, X: 4, Y: 4}}}
				next := cloneWorld(world)
				next.Units[0].X = 5
				store := &decorationMutationStore{seed: gamewire.Seed{World: world, NPCs: []gamewire.Actor{{ID: "npc:customer", State: "eating", TableID: "table", Food: &gamewire.Food{Recipe: "nachos"}, ActionRemaining: 60000}}}, result: gamewire.Result{Status: status, World: &next}}
				m := New(store, Options{Grace: time.Hour})
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				defer m.Close(ctx)
				user := "owner"
				if guest {
					user = "guest"
				}
				_, err := m.Operate(ctx, gamewire.Operation{Owner: "owner", User: user, Action: "move", Body: json.RawMessage(`{"unitId":"table","tx":5,"ty":4,"rotation":0}`)})
				if err != nil {
					t.Fatal(err)
				}
				value, err := m.call(ctx, "owner", func(r *room) any {
					a := r.actors["npc:customer"]
					return a.DecorationExit && a.Food != nil && a.State == "eating"
				})
				if err != nil {
					t.Fatal(err)
				}
				if value.(bool) != (status == 200 && !guest) {
					t.Fatal("failed or forbidden mutation affected live customer")
				}
			})
		}
	}
}

func TestDecorationDrinkAndDetachedSupportSurviveDormancy(t *testing.T) {
	r, _, c, _ := waiterRoom(t)
	now := time.Now()
	store := &decorationMutationStore{}
	r.manager.store = store
	c.State = "drinking"
	c.CoffeeRequestID = "paid-nonce"
	c.Action = &gamewire.ActorAction{Kind: "drinking", Duration: 5000, StartedAt: now.UnixMilli()}
	c.due = now.Add(5 * time.Second)
	next := cloneWorld(r.world)
	next.Units[1].Placed = false
	r.updateWorld(next)
	if c.State != "drinking" || c.Action == nil || c.CoffeeRequestID != "" || !c.due.Equal(now.Add(5*time.Second)) {
		t.Fatal("drink timer or paid request invalidation is incorrect")
	}
	if err := r.sleep(now); err != nil {
		t.Fatal(err)
	}
	if len(store.saved.NPCs) != 1 {
		t.Fatal("detached customer missing from dormant state")
	}
	var saved gamewire.Actor
	body, _ := json.Marshal(store.saved.NPCs[0])
	_ = json.Unmarshal(body, &saved)
	if !saved.DecorationExit || !saved.Judged || saved.DetachedTable == nil || saved.ActionRemaining != 5000 || saved.Action == nil {
		t.Fatal("dormancy lost detached support or remaining drink")
	}
}

func TestDecorationAcceptsNPCsAndWaitersButProtectsHumanUsers(t *testing.T) {
	for _, kind := range []string{"npc", "waiter", "human"} {
		t.Run(kind, func(t *testing.T) {
			r, _ := stuckRoom([]gamewire.Unit{{ID: "chair", ItemID: 3040001, Placed: true, X: 3, Y: 3}, {ID: "table", ItemID: 3030010, Placed: true, X: 4, Y: 3}, {ID: "door", ItemID: 3010000, Placed: true, X: 4, Y: 0, Rotation: 1}})
			a := addNPC(r, "actor", 3, 3, time.Now())
			a.Kind = kind
			a.ChairID = "chair"
			a.TableID = "table"
			r.seats["chair"] = a.ID
			for _, action := range []string{"move", "store", "sell", "purchase"} {
				for _, id := range []string{"chair", "table"} {
					body, _ := json.Marshal(map[string]any{"unitId": id, "itemId": 3030010, "tx": 3, "ty": 3, "rotation": 0})
					message := r.validateOperation(gamewire.Operation{Action: action, Body: body})
					if (message != "") != (kind == "human") {
						t.Fatalf("%s %s %s: %s", kind, action, id, message)
					}
				}
			}
			a.Kind = "npc"
			a.State = "entering"
			a.X, a.Y = 4, 1
			if message := r.validateOperation(gamewire.Operation{Action: "store", Body: json.RawMessage(`{"unitId":"door"}`)}); message != "" {
				t.Fatal(message)
			}
		})
	}
}

func TestDecorationFinishesMealBeforeLeavingAndDoesNotRefundOrCharge(t *testing.T) {
	r, _, c, store := waiterRoom(t)
	now := time.Now()
	r.world.Units = append(r.world.Units, gamewire.Unit{ID: "door", ItemID: 3010000, Placed: true, X: 4, Y: 0, Rotation: 1})
	r.grid = newGrid(r.world)
	c.State = "eating"
	c.Food = &gamewire.Food{Recipe: "nachos"}
	c.due = now.Add(5 * time.Second)
	next := cloneWorld(r.world)
	next.Units[1].X = 5
	r.updateWorld(next)
	r.tick(now.Add(4 * time.Second))
	if c.State != "eating" || c.Food == nil || c.Move != nil {
		t.Fatal("meal was interrupted before its deadline")
	}
	r.tick(now.Add(5 * time.Second))
	if c.State != "leaving" || c.Food != nil || c.DetachedChair != nil || c.DetachedTable != nil || store.consumed != 0 || r.world.Foods[0].Portions != 2 || !c.Judged {
		t.Fatal("finished customer retained service or changed meal accounting")
	}
}

func TestDecorationClaimDoesNotRefundOrInterruptMeal(t *testing.T) {
	r, _, c, store := waiterRoom(t)
	now := time.Now()
	c.State = "eating"
	c.Food = &gamewire.Food{Recipe: "nachos"}
	c.due = now.Add(8 * time.Second)
	owner := &entity{}
	if msg := r.claimTableEdit(owner, "table"); msg != "" {
		t.Fatal(msg)
	}
	r.claimTableEdit(owner, "")
	if c.State != "eating" || c.Food == nil || store.consumed != 0 || c.DecorationExit {
		t.Fatal("selection/cancel changed the meal")
	}
}

func TestDecorationCommitKeepsServedMealAndDeadlineExactlyOnce(t *testing.T) {
	for _, action := range []string{"move", "store", "sell"} {
		t.Run(action, func(t *testing.T) {
			r, w, c, store := waiterRoom(t)
			now := time.Now()
			c.State, c.Ate = "eating", true
			c.ChairID = "chair"
			r.world.Units = append(r.world.Units, gamewire.Unit{ID: "chair", ItemID: 3040001, Placed: true, X: c.X, Y: c.Y})
			r.seats[c.ChairID] = c.ID
			c.Food = &gamewire.Food{Recipe: "nachos"}
			c.Action = &gamewire.ActorAction{Kind: "eating", StartedAt: now.UnixMilli(), Duration: 8000}
			c.due = now.Add(8 * time.Second)
			w.WaiterCustomerID = c.ID
			w.State = "waiter_delivery"
			next := cloneWorld(r.world)
			for i, u := range next.Units {
				if u.ID == "table" {
					if action == "move" {
						next.Units[i].X--
					} else {
						next.Units[i].Placed = false
					}
				}
			}
			if action == "sell" {
				next.Units = next.Units[0:1]
				next.Units = append(next.Units, r.world.Units[2])
			}
			r.prepareDecorationChanges(next, now)
			r.prepareDecorationChanges(next, now)
			if !c.DecorationExit || !c.Judged || c.ChairID != "" || c.TableID != "" || len(r.seats) != 0 || c.DetachedChair == nil || c.DetachedTable == nil {
				t.Fatal("reservations or original support not detached")
			}
			if c.State != "eating" || c.Food == nil || !c.due.Equal(now.Add(8*time.Second)) || c.Action.Duration != 8000 || store.consumed != 0 || r.world.Foods[0].Portions != 2 {
				t.Fatal("meal was lost, refunded, charged twice or shortened")
			}
			if w.WaiterCustomerID != "" {
				t.Fatal("waiter retained obsolete reservation")
			}
		})
	}
}

func TestDecorationPlacementPreservesCurrentStepButCancelsOldDestination(t *testing.T) {
	r, _ := stuckRoom(nil)
	now := time.Now()
	c := addNPC(r, "npc:walker", 3, 3, now)
	c.Move = &gamewire.Movement{From: Tile{X: 3, Y: 3}, To: Tile{X: 4, Y: 3}, StartedAt: now.UnixMilli(), Duration: 800}
	original := *c.Move
	c.path = []Tile{{X: 5, Y: 3}}
	next := cloneWorld(r.world)
	next.Units = append(next.Units, gamewire.Unit{ID: "new", ItemID: 3030010, Placed: true, X: 4, Y: 3})
	r.prepareDecorationChanges(next, now)
	if !c.DecorationExit || *c.Move != original || len(c.path) != 0 {
		t.Fatal("placement interrupted a half-step or retained the invalid destination")
	}
}
