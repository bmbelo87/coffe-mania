package gameruntime

import (
	"coffe-mania/shared/gamewire"
	"encoding/json"
	"time"
)

func (r *room) readyJuice() bool {
	for _, stock := range r.world.Juices {
		if stock.Unlocked && stock.Portions > 0 {
			return true
		}
	}
	return false
}
func (r *room) validateJuiceOperation(op *gamewire.Operation) string {
	if op.Action != "juice_serve" {
		return ""
	}
	var body struct {
		MachineID      string `json:"machineId"`
		ActorID        string `json:"actorId"`
		RequestID      string `json:"requestId"`
		JuiceRequestID string `json:"juiceRequestId"`
	}
	if json.Unmarshal(op.Body, &body) != nil {
		return "Pedido de suco inválido."
	}
	actor := r.actors[body.ActorID]
	if actor == nil || actor.Kind != "npc" || actor.JuiceRequestID == "" || actor.CoffeeRequestID != "" || (actor.State != "thirsty" && actor.State != "drinking") {
		return "Este cliente não está pedindo suco."
	}
	if !time.Now().Before(actor.due) {
		return "O cliente já terminou de esperar."
	}
	if body.JuiceRequestID != actor.JuiceRequestID {
		return "Pedido de suco expirado."
	}
	body.RequestID = actor.JuiceRequestID
	op.Body, _ = json.Marshal(body)
	return ""
}
func (r *room) finishJuiceOperation(op gamewire.Operation, now time.Time) {
	if op.Action != "juice_serve" {
		return
	}
	var body struct {
		ActorID string `json:"actorId"`
	}
	_ = json.Unmarshal(op.Body, &body)
	if a := r.actors[body.ActorID]; a != nil && a.State == "thirsty" && a.JuiceRequestID != "" && a.CoffeeRequestID == "" {
		a.State = "drinking"
		a.due = now.Add(beverageDrinkingTime)
		a.Action = nil
		r.startEmotion(a, "satisfied", now)
		r.broadcast(gamewire.Event{Type: "actors", Actors: []gamewire.Actor{r.status(a, false)}}, "")
	}
}
