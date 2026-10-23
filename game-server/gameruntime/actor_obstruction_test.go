package gameruntime

import (
	"testing"
	"time"

	"coffe-mania/shared/gamewire"
)

func actorAisle() []gamewire.Unit {
	units := []gamewire.Unit{{ID: "chair", ItemID: 3040001, Placed: true, X: 6, Y: 1, Rotation: 1}, {ID: "door", ItemID: 3010000, Placed: true, X: 4, Y: 0, Rotation: 1}}
	for x := 1; x < 8; x++ {
		units = append(units, gamewire.Unit{ID: "table" + string(rune('a'+x)), ItemID: 3030010, Placed: true, X: x, Y: 2})
	}
	return units
}

func TestActorObstructionWaitsThenSeatsWithoutAnger(t *testing.T) {
	r, m := stuckRoom(actorAisle())
	now := time.Now()
	customer := addNPC(r, "npc:customer", 2, 1, now)
	blocker := addNPC(r, "human:blocker", 3, 1, now.Add(time.Hour))
	blocker.Kind, blocker.State = "human", "idle"
	r.tick(now)
	if customer.visits != 0 || customer.Move != nil || !customer.blockedByActors {
		t.Fatalf("actor wait counted as failed visit: %+v", customer)
	}
	for i := 1; i < 3; i++ {
		r.tick(now.Add(time.Duration(i) * time.Second))
		if customer.Move != nil || customer.visits != 0 {
			t.Fatal("customer crossed before the grace period or became impatient")
		}
	}
	r.tick(now.Add(npcGhostAfter))
	if customer.Move == nil || !customer.ghost || customer.State != "to_seat" {
		t.Fatalf("customer did not cross after 3s: %+v", customer)
	}
	for i := 0; i < 120 && customer.State != "seated"; i++ {
		r.tick(now.Add(npcGhostAfter + time.Duration(i+1)*m.options.Tick))
	}
	if customer.State != "seated" || customer.Emotion != nil || customer.Judged || m.store.(*verdictStore).dissatisfied != 0 {
		t.Fatalf("actor obstruction caused anger or lost the seat: %+v", customer)
	}
}

func TestActorObstructionNeverAllowsFurnitureOrHumanGhost(t *testing.T) {
	r, _ := stuckRoom(actorAisle())
	now := time.Now()
	customer := addNPC(r, "npc:customer", 2, 1, now)
	r.grid.add(gamewire.Unit{ID: "obstacle", ItemID: 3030010, Placed: true, X: 3, Y: 1})
	if r.route(customer, Tile{X: 5, Y: 1}, now) || r.route(customer, Tile{X: 5, Y: 1}, now.Add(4*time.Second)) || customer.ghost || customer.blockedByActors {
		t.Fatal("solid furniture was treated as a temporary actor")
	}
	if !r.gaveUp(customer, now.Add(npcGiveUpAfter)) {
		t.Fatal("permanent obstruction lost its timeout")
	}
	r.grid.remove(gamewire.Unit{ID: "obstacle", ItemID: 3030010, Placed: true, X: 3, Y: 1})
	blocker := addNPC(r, "npc:blocker", 3, 1, now.Add(time.Hour))
	blocker.State = "idle"
	human := addNPC(r, "human:chef", 1, 1, now)
	human.Kind = "human"
	if r.route(human, Tile{X: 5, Y: 1}, now) || r.route(human, Tile{X: 5, Y: 1}, now.Add(4*time.Second)) || human.ghost {
		t.Fatal("human chef acquired NPC crossing permission")
	}
}

func TestActorObstructionAtDiagonalCornerReplans(t *testing.T) {
	r, _ := stuckRoom(nil)
	now := time.Now()
	customer := addNPC(r, "npc:diagonal", 2, 2, now)
	for i, tile := range []Tile{{X: 3, Y: 2}, {X: 2, Y: 3}} {
		b := addNPC(r, "human:"+string(rune('a'+i)), tile.X, tile.Y, now.Add(time.Hour))
		b.Kind = "human"
	}
	customer.path = []Tile{{X: 3, Y: 3}}
	if !r.nextStep(customer, now) || customer.Move == nil {
		t.Fatal("temporary diagonal corner dropped the path instead of taking the available detour")
	}
	if customer.Move.To == (Tile{X: 3, Y: 3}) {
		t.Fatal("customer cut through two occupied corner tiles before waiting")
	}
}

func TestActorObstructionLongWaitDoesNotGiveUp(t *testing.T) {
	r, _ := stuckRoom(nil)
	now := time.Now()
	customer := addNPC(r, "npc:waiting", 2, 2, now)
	r.noteStuck(customer, now, true)
	if r.gaveUp(customer, now.Add(time.Minute)) {
		t.Fatal("actor-only obstruction removed customer")
	}
	r.noteStuck(customer, now, false)
	if !r.gaveUp(customer, now.Add(time.Minute)) {
		t.Fatal("permanent geometry obstruction should retain give-up behavior")
	}
}
