package gameruntime

import (
	"coffe-mania/shared/gamewire"
	"encoding/json"
	"testing"
	"time"
)

func TestJuiceServeRequiresLiveNPCRequest(t *testing.T) {
	r, _ := stuckRoom(nil)
	now := time.Now()
	npc := addNPC(r, "npc:juice", 3, 3, now.Add(time.Minute))
	npc.State = "thirsty"
	npc.JuiceRequestID = "customer-0000000001"
	operation := func(actor, nonce string) *gamewire.Operation {
		body, _ := json.Marshal(map[string]string{"actorId": actor, "juiceRequestId": nonce, "machineId": "machine", "requestId": "client-request-0001"})
		return &gamewire.Operation{Action: "juice_serve", Body: body}
	}
	if r.validateJuiceOperation(operation("npc:absent", npc.JuiceRequestID)) == "" {
		t.Fatal("nonexistent customer accepted")
	}
	if r.validateJuiceOperation(operation(npc.ID, "forged-request")) == "" {
		t.Fatal("forged nonce accepted")
	}
	op := operation(npc.ID, npc.JuiceRequestID)
	if message := r.validateJuiceOperation(op); message != "" {
		t.Fatal(message)
	}
	var body map[string]string
	_ = json.Unmarshal(op.Body, &body)
	if body["requestId"] != npc.JuiceRequestID {
		t.Fatal("client chooses the payment key")
	}
	npc.due = now.Add(-time.Second)
	if r.validateJuiceOperation(operation(npc.ID, npc.JuiceRequestID)) == "" {
		t.Fatal("expired request accepted")
	}
	npc.Kind = "human"
	npc.due = now.Add(time.Minute)
	if r.validateJuiceOperation(operation(npc.ID, npc.JuiceRequestID)) == "" {
		t.Fatal("human fabricated an NPC request")
	}
}
func TestJuiceServeRetryDoesNotRestartCustomerAction(t *testing.T) {
	r, _ := stuckRoom(nil)
	now := time.Now()
	npc := addNPC(r, "npc:juice", 3, 3, now.Add(time.Minute))
	npc.State = "thirsty"
	npc.JuiceRequestID = "customer-0000000002"
	body, _ := json.Marshal(map[string]string{"actorId": npc.ID})
	op := gamewire.Operation{Action: "juice_serve", Body: body}
	r.finishJuiceOperation(op, now)
	if npc.State != "drinking" {
		t.Fatal("customer did not start drinking")
	}
	due := npc.due
	r.finishJuiceOperation(op, now.Add(time.Second))
	if npc.due != due {
		t.Fatal("retry restarted the action")
	}
}
func TestJuiceIgnoredRequestDoesNotPenalizeCustomer(t *testing.T) {
	r, m := stuckRoom([]gamewire.Unit{{ID: "chair", ItemID: 3040001, Placed: true, X: 3, Y: 3}})
	now := time.Now()
	npc := addNPC(r, "npc:juice", 3, 3, now)
	npc.State = "thirsty"
	npc.ChairID = "chair"
	npc.Ate = true
	npc.JuiceRequestID = "expired-request"
	r.seats["chair"] = npc.ID
	r.advanceNPC(npc, now)
	if npc.State == "thirsty" || npc.JuiceRequestID != "" || r.seats["chair"] != "" {
		t.Fatal("expired request did not release chair")
	}
	r.judge(npc, now)
	if m.store.(*verdictStore).dissatisfied != 0 {
		t.Fatal("ignored juice caused popularity penalty")
	}
}
