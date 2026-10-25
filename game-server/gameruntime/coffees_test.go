package gameruntime

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"coffe-mania/shared/gamewire"
)

func coffeeOperation(actor, nonce string) gamewire.Operation {
	body, _ := json.Marshal(map[string]string{
		"machineId": "coffee", "actorId": actor, "coffeeRequestId": nonce, "requestId": "browser-chosen-key",
	})
	return gamewire.Operation{Owner: "owner", User: "owner", Action: "coffee_serve", Body: body}
}

func TestCoffeeRequiresLiveMatchingNPCRequest(t *testing.T) {
	r, _ := stuckRoom(nil)
	r.id = "owner"
	npc := addNPC(r, "npc:coffee", 3, 3, time.Now().Add(time.Minute))
	r.startBeverageRequest(npc, true, time.Now())
	nonce := npc.CoffeeRequestID
	for _, test := range []struct {
		name   string
		mutate func(*gamewire.Operation)
	}{
		{"guest", func(op *gamewire.Operation) { op.User = "guest" }},
		{"another room", func(op *gamewire.Operation) { op.Owner = "other" }},
		{"nonexistent actor", func(op *gamewire.Operation) { *op = coffeeOperation("npc:absent", nonce) }},
		{"forged nonce", func(op *gamewire.Operation) { *op = coffeeOperation(npc.ID, "forged-nonce") }},
	} {
		t.Run(test.name, func(t *testing.T) {
			op := coffeeOperation(npc.ID, nonce)
			test.mutate(&op)
			if r.validateCoffeeOperation(&op) == "" {
				t.Fatal("forged coffee request accepted")
			}
		})
	}
	op := coffeeOperation(npc.ID, nonce)
	if message := r.validateCoffeeOperation(&op); message != "" {
		t.Fatal(message)
	}
	var body map[string]string
	_ = json.Unmarshal(op.Body, &body)
	if body["requestId"] != nonce {
		t.Fatal("the browser chose the payment idempotency key")
	}
	for _, state := range []string{"thirsty", "drinking"} {
		npc.State, npc.due = state, time.Now().Add(-time.Second)
		op = coffeeOperation(npc.ID, nonce)
		if r.validateCoffeeOperation(&op) == "" {
			t.Fatalf("expired %s request accepted", state)
		}
	}
	npc.State, npc.due, npc.Kind = "thirsty", time.Now().Add(time.Minute), "human"
	op = coffeeOperation(npc.ID, nonce)
	if r.validateCoffeeOperation(&op) == "" {
		t.Fatal("human fabricated a coffee request")
	}
}

func TestCoffeeAndJuiceRequestsAreMutuallyExclusive(t *testing.T) {
	r, _ := stuckRoom(nil)
	r.id = "owner"
	npc := addNPC(r, "npc:drink", 3, 3, time.Now())
	r.startBeverageRequest(npc, false, time.Now())
	juiceNonce := npc.JuiceRequestID
	if juiceNonce == "" || npc.CoffeeRequestID != "" {
		t.Fatal("juice request also contains coffee")
	}
	r.startBeverageRequest(npc, true, time.Now())
	if npc.CoffeeRequestID == "" || npc.JuiceRequestID != "" {
		t.Fatal("coffee request retained the previous juice request")
	}
	body, _ := json.Marshal(map[string]string{"actorId": npc.ID, "juiceRequestId": juiceNonce})
	op := gamewire.Operation{Action: "juice_serve", Body: body}
	if r.validateJuiceOperation(&op) == "" {
		t.Fatal("juice served to a coffee customer")
	}
	r.finishJuiceOperation(op, time.Now())
	if npc.State != "thirsty" {
		t.Fatal("the wrong beverage started drinking")
	}
	coffeeNonce := npc.CoffeeRequestID
	r.startBeverageRequest(npc, false, time.Now())
	op = coffeeOperation(npc.ID, coffeeNonce)
	if r.validateCoffeeOperation(&op) == "" {
		t.Fatal("coffee served to a juice customer")
	}
}

func TestCoffeeRetryDoesNotRestartDrinkingOrEmotion(t *testing.T) {
	r, _ := stuckRoom(nil)
	r.id = "owner"
	now := time.Now()
	npc := addNPC(r, "npc:coffee", 3, 3, now)
	r.startBeverageRequest(npc, true, now)
	op := coffeeOperation(npc.ID, npc.CoffeeRequestID)
	r.finishCoffeeOperation(op, now)
	if npc.State != "drinking" || npc.due != now.Add(beverageDrinkingTime) {
		t.Fatal("coffee customer did not begin drinking")
	}
	due, emotion := npc.due, npc.Emotion.ID
	if message := r.validateCoffeeOperation(&op); message != "" {
		t.Fatal("safe in-flight retry was rejected:", message)
	}
	r.finishCoffeeOperation(op, now.Add(time.Second))
	if npc.due != due || npc.Emotion.ID != emotion {
		t.Fatal("retry restarted the drink or its satisfied reaction")
	}
}

func TestCoffeeStandingInvalidatesNonceEvenWhenBoxedIn(t *testing.T) {
	units := []gamewire.Unit{{ID: "chair", ItemID: 3040001, Placed: true, X: 3, Y: 3}}
	for y := 2; y <= 4; y++ {
		for x := 2; x <= 4; x++ {
			if x != 3 || y != 3 {
				units = append(units, gamewire.Unit{ID: string(rune('a' + y*5 + x)), ItemID: 3030010, Placed: true, X: x, Y: y})
			}
		}
	}
	r, m := stuckRoom(units)
	r.id = "owner"
	now := time.Now()
	npc := addNPC(r, "npc:coffee", 3, 3, now)
	npc.ChairID, npc.Ate = "chair", true
	r.seats[npc.ChairID] = npc.ID
	r.startBeverageRequest(npc, true, now.Add(-time.Minute))
	nonce := npc.CoffeeRequestID
	r.standNPC(npc, now)
	if npc.CoffeeRequestID != "" || npc.JuiceRequestID != "" {
		t.Fatal("blocked standing extended a beverage nonce")
	}
	op := coffeeOperation(npc.ID, nonce)
	if r.validateCoffeeOperation(&op) == "" {
		t.Fatal("expired request became payable again while waiting for floor space")
	}
	r.judge(npc, now)
	if m.store.(*verdictStore).dissatisfied != 0 {
		t.Fatal("ignoring coffee penalized an already fed customer")
	}
}

func TestCoffeeDecorationClearsPendingRequests(t *testing.T) {
	r, _, customer, _ := waiterRoom(t)
	r.id = "owner"
	owner := addNPC(r, "human:owner", 1, 1, time.Now())
	owner.Kind = "human"
	customer.State, customer.Ate = "thirsty", true
	customer.CoffeeRequestID = "coffee-request"
	if message := r.prepareTableEdit(owner, "table"); message != "" {
		t.Fatal(message)
	}
	if r.actors[customer.ID] != nil || customer.CoffeeRequestID != "" || customer.JuiceRequestID != "" {
		t.Fatal("decoration retained a removed customer's beverage nonce")
	}
	op := coffeeOperation(customer.ID, "coffee-request")
	if r.validateCoffeeOperation(&op) == "" {
		t.Fatal("decorated-away customer accepted a coffee service")
	}
}

type coffeeRuntimeStore struct {
	Storage
	seed       gamewire.Seed
	saved      gamewire.Sleep
	operations []gamewire.Operation
	paid       map[string]bool
}

func (s *coffeeRuntimeStore) Load(context.Context, string) (gamewire.Seed, error) {
	return s.seed, nil
}
func (s *coffeeRuntimeStore) Sleep(_ context.Context, _ string, state gamewire.Sleep) error {
	s.saved = state
	return nil
}
func (s *coffeeRuntimeStore) Operate(_ context.Context, op gamewire.Operation) (gamewire.Result, error) {
	s.operations = append(s.operations, op)
	var body struct {
		RequestID string `json:"requestId"`
	}
	_ = json.Unmarshal(op.Body, &body)
	s.paid[body.RequestID] = true
	w := cloneWorld(s.seed.World)
	return gamewire.Result{Status: 200, World: &w}, nil
}

func TestCoffeeManagerSerializesOwnerValidationAndReplay(t *testing.T) {
	store := &coffeeRuntimeStore{paid: map[string]bool{}, seed: gamewire.Seed{World: gamewire.World{
		RoomID: "owner", TilesX: 8, TilesY: 8, Coffees: []gamewire.CoffeeMachine{{MachineID: "coffee", RecipeID: "espresso", Stage: 1}},
	}}}
	m := New(store, Options{Tick: time.Hour, Grace: time.Hour})
	ctx := context.Background()
	t.Cleanup(func() { _ = m.Close(ctx) })
	r, err := m.get(ctx, "owner")
	if err != nil {
		t.Fatal(err)
	}
	var nonce string
	_, err = r.call(ctx, func(r *room) any {
		a := addNPC(r, "npc:coffee", 3, 3, time.Now())
		r.startBeverageRequest(a, true, time.Now())
		nonce = a.CoffeeRequestID
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	op := coffeeOperation("npc:coffee", nonce)
	guest := op
	guest.User = "guest"
	result, err := m.Operate(ctx, guest)
	if err != nil || result.Status != 403 || len(store.operations) != 0 {
		t.Fatal("guest reached durable mutation")
	}
	for range 2 {
		result, err = m.Operate(ctx, op)
		if err != nil || result.Status != 200 {
			t.Fatal("valid service/retry failed", err, result.Status)
		}
	}
	if len(store.operations) != 2 || len(store.paid) != 1 || !store.paid[nonce] {
		t.Fatal("room did not forward the same server payment key for a retry")
	}
	_, err = r.call(ctx, func(r *room) any {
		if r.actors["npc:coffee"].State != "drinking" {
			t.Error("queued success did not enter drinking")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestCoffeeSleepAndRestoreInvalidateNonces(t *testing.T) {
	r, _ := stuckRoom(nil)
	store := &coffeeRuntimeStore{}
	r.manager.store = store
	now := time.Now()
	for _, coffee := range []bool{true, false} {
		id := "npc:juice"
		if coffee {
			id = "npc:coffee"
		}
		a := addNPC(r, id, 3, 3, now)
		r.startBeverageRequest(a, coffee, now)
	}
	if err := r.sleep(now); err != nil {
		t.Fatal(err)
	}
	for _, saved := range store.saved.NPCs {
		if saved.CoffeeRequestID != "" || saved.JuiceRequestID != "" || saved.ActionRemaining != 0 {
			t.Fatal("sleep retained a payable request")
		}
	}
	legacy := gamewire.Actor{State: "thirsty", CoffeeRequestID: "old-coffee", JuiceRequestID: "old-juice", ActionRemaining: 15000}
	sanitizeBeverageRestore(&legacy)
	if legacy.CoffeeRequestID != "" || legacy.JuiceRequestID != "" || legacy.ActionRemaining != 0 {
		t.Fatal("legacy restored a nonce across room epochs")
	}
}

func TestCoffeeWorldBroadcastsStageSelectionAndRemoval(t *testing.T) {
	r, _ := stuckRoom(nil)
	p := &Peer{ID: "observer", Out: make(chan []byte, 8)}
	r.peers[p.ID] = p
	w := cloneWorld(r.world)
	w.Coffees = []gamewire.CoffeeMachine{{MachineID: "coffee", RecipeID: "espresso", Stage: 1}}
	for _, stage := range []int{1, 2} {
		w.Coffees[0].Stage = stage
		r.updateWorld(w)
		select {
		case raw := <-p.Out:
			var event gamewire.Event
			_ = json.Unmarshal(raw, &event)
			if event.Type != "coffees" || len(event.Coffees) != 1 || event.Coffees[0].Stage != stage {
				t.Fatal("coffee-only update was not broadcast")
			}
		default:
			t.Fatal("missing coffee event")
		}
	}
	w.Coffees[0].RecipeID = "decaf"
	if r.world.Coffees[0].RecipeID != "espresso" {
		t.Fatal("world shares the caller's mutable coffee slice")
	}
	r.updateWorld(w)
	<-p.Out
	w.Coffees = nil
	r.updateWorld(w)
	var event gamewire.Event
	_ = json.Unmarshal(<-p.Out, &event)
	if event.Type != "coffees" || len(event.Coffees) != 0 {
		t.Fatal("machine removal was not broadcast")
	}
}
