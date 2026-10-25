package gameruntime

import (
	"encoding/json"
	"math/rand/v2"
	"time"

	"coffe-mania/shared/gamewire"
	"github.com/google/uuid"
)

// PROVISIONAL calibration: the historical sources confirm optional drink requests, not
// their frequency or timers. Coffee and juice share one draw so having both machines
// does not double the chance or issue two requests for the same completed meal.
const (
	beverageRequestChance = .5
	beverageWaitingTime   = 15 * time.Second
	beverageDrinkingTime  = 3 * time.Second
)

func (r *room) readyCoffee() bool {
	return len(r.world.Coffees) > 0
}

func clearBeverageRequests(a *entity) {
	a.JuiceRequestID = ""
	a.CoffeeRequestID = ""
}

// Pending room nonces expire on sleep/reload. They must never become reusable payment
// keys after a room epoch changes; an already served drink may finish its saved animation.
func sanitizeBeverageRestore(a *gamewire.Actor) {
	a.JuiceRequestID, a.CoffeeRequestID = "", ""
	if a.State == "thirsty" {
		a.ActionRemaining = 0
		a.Action = nil
	}
}

func (r *room) requestBeverage(a *entity, now time.Time) bool {
	clearBeverageRequests(a)
	coffee, juice := r.readyCoffee(), r.readyJuice()
	if (!coffee && !juice) || rand.Float64() >= beverageRequestChance {
		return false
	}
	if coffee && (!juice || rand.IntN(2) == 0) {
		r.startBeverageRequest(a, true, now)
	} else {
		r.startBeverageRequest(a, false, now)
	}
	return true
}

func (r *room) startBeverageRequest(a *entity, coffee bool, now time.Time) {
	clearBeverageRequests(a)
	a.State = "thirsty"
	if coffee {
		a.CoffeeRequestID = uuid.NewString()
	} else {
		a.JuiceRequestID = uuid.NewString()
	}
	a.Food, a.Action = nil, nil
	a.due = now.Add(beverageWaitingTime)
}

func (r *room) validateCoffeeOperation(op *gamewire.Operation) string {
	if op.Action != "coffee_serve" && op.Action != "coffee_select" && op.Action != "coffee_recharge" {
		return ""
	}
	if op.Owner != r.id || op.User != r.id {
		return "Somente o dono pode servir ou alterar os cafés."
	}
	if op.Action != "coffee_serve" {
		return ""
	}
	var body struct {
		MachineID       string `json:"machineId"`
		RecipeID        string `json:"recipeId,omitempty"`
		ActorID         string `json:"actorId"`
		RequestID       string `json:"requestId"`
		CoffeeRequestID string `json:"coffeeRequestId"`
	}
	if json.Unmarshal(op.Body, &body) != nil {
		return "Pedido de café inválido."
	}
	actor := r.actors[body.ActorID]
	if actor == nil || actor.Kind != "npc" || actor.CoffeeRequestID == "" || actor.JuiceRequestID != "" ||
		(actor.State != "thirsty" && actor.State != "drinking") {
		return "Este cliente não está pedindo café."
	}
	if !time.Now().Before(actor.due) {
		return "O cliente já terminou de esperar."
	}
	if body.CoffeeRequestID != actor.CoffeeRequestID {
		return "Pedido de café expirado."
	}
	// A retry while drinking reaches persistence with the same idempotency key. It
	// neither picks a new payment key nor restarts the room animation on success.
	body.RequestID = actor.CoffeeRequestID
	op.Body, _ = json.Marshal(body)
	return ""
}

func (r *room) finishCoffeeOperation(op gamewire.Operation, now time.Time) {
	if op.Action != "coffee_serve" {
		return
	}
	var body struct {
		ActorID string `json:"actorId"`
	}
	_ = json.Unmarshal(op.Body, &body)
	if a := r.actors[body.ActorID]; a != nil && a.State == "thirsty" && a.CoffeeRequestID != "" && a.JuiceRequestID == "" {
		a.State = "drinking"
		a.due = now.Add(beverageDrinkingTime)
		a.Action = nil
		r.startEmotion(a, "satisfied", now)
		r.broadcast(gamewire.Event{Type: "actors", Actors: []gamewire.Actor{r.status(a, false)}}, "")
	}
}
