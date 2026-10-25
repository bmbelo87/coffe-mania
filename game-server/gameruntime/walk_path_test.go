package gameruntime

import (
	"encoding/json"
	"testing"
	"time"

	"coffe-mania/shared/gamewire"
)

func walkRoom(t *testing.T) (*room, *entity, *Peer) {
	t.Helper()
	r, _ := stuckRoom(nil)
	r.id = "owner"
	a := addNPC(r, "human:owner", 1, 1, time.Now())
	a.Kind, a.State = "human", "idle"
	return r, a, &Peer{Ticket: gamewire.Ticket{User: "owner"}, Out: make(chan []byte, 8)}
}

func walk(r *room, p *Peer, dest Tile, path []Tile) string {
	x, y := dest.X, dest.Y
	r.command(p, gamewire.Command{Type: "walk", RequestID: "w", X: &x, Y: &y, Path: path})
	var event gamewire.Event
	for len(p.Out) > 0 {
		_ = json.Unmarshal(<-p.Out, &event)
	}
	return event.Type
}

// The client animates its own route at once; the room follows the same route when it is valid,
// even where its own A* would pick another of equal cost.
func TestWalkFollowsTheClientRouteWhenValid(t *testing.T) {
	r, a, p := walkRoom(t)
	route := []Tile{{X: 2, Y: 1}, {X: 3, Y: 1}, {X: 3, Y: 2}, {X: 3, Y: 3}}
	if walk(r, p, Tile{X: 3, Y: 3}, route) != "ack" {
		t.Fatal("caminhada recusada")
	}
	if a.Move == nil || a.Move.To != route[0] || len(a.path) != 3 || a.path[2] != route[3] {
		t.Fatalf("rota do cliente não seguida: move %+v, path %v", a.Move, a.path)
	}
}

func TestWalkPlansItsOwnRouteWhenTheClientRouteIsInvalid(t *testing.T) {
	cases := map[string][]Tile{
		"salto":           {{X: 3, Y: 1}, {X: 3, Y: 3}},
		"outro destino":   {{X: 2, Y: 2}},
		"fora da sala":    {{X: 0, Y: 1}, {X: 1, Y: 2}, {X: 2, Y: 3}, {X: 3, Y: 3}},
		"ocupado por NPC": {{X: 2, Y: 1}, {X: 3, Y: 2}, {X: 3, Y: 3}},
	}
	for name, route := range cases {
		r, a, p := walkRoom(t)
		addNPC(r, "npc:blocker", 2, 1, time.Now().Add(time.Hour))
		if walk(r, p, Tile{X: 3, Y: 3}, route) != "ack" {
			t.Fatalf("%s: caminhada recusada", name)
		}
		if a.Move == nil || a.Move.To == route[0] && name != "outro destino" {
			t.Fatalf("%s: seguiu a rota inválida: %+v", name, a.Move)
		}
		last := a.Move.To
		if len(a.path) > 0 {
			last = a.path[len(a.path)-1]
		}
		if last != (Tile{X: 3, Y: 3}) {
			t.Fatalf("%s: rota própria não chega ao destino: %v", name, a.path)
		}
	}
}
