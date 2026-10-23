package gameruntime

import (
	"testing"
	"time"

	"coffe-mania/shared/gamewire"
)

func stuckRoom(units []gamewire.Unit) (*room, *Manager) {
	world := gamewire.World{TilesX: 8, TilesY: 8, Units: units}
	m := New(&verdictStore{}, Options{})
	return &room{manager: m, world: world, grid: newGrid(world), actors: map[string]*entity{}, peers: map[string]*Peer{}, seats: map[string]string{},
		occupancy: map[Tile]map[string]bool{}, actorTiles: map[string][]Tile{}, spawnAt: time.Now().Add(time.Hour)}, m
}

func addNPC(r *room, id string, x, y int, due time.Time) *entity {
	a := &entity{Actor: gamewire.Actor{ID: id, Kind: "npc", X: x, Y: y, State: "wandering"}, due: due}
	r.actors[id] = a
	r.indexActor(a)
	return a
}

// A one-tile aisle between the wall and a row of tables: two customers walking in
// opposite directions can never swap places without passing through each other.
func TestCustomersFaceToFaceInAisleGetThrough(t *testing.T) {
	units := []gamewire.Unit{}
	for x := 1; x < 8; x++ {
		units = append(units, gamewire.Unit{ID: "table" + string(rune('a'+x)), ItemID: 3030010, Placed: true, X: x, Y: 2})
	}
	r, m := stuckRoom(units)
	now := time.Now()
	// Both routes were planned before they met in the aisle.
	a := addNPC(r, "npc:a", 2, 1, now)
	b := addNPC(r, "npc:b", 5, 1, now)
	a.path = findPath(Tile{X: 2, Y: 1}, Tile{X: 6, Y: 1}, r.grid.walkable, 256)
	b.path = findPath(Tile{X: 5, Y: 1}, Tile{X: 1, Y: 1}, r.grid.walkable, 256)
	if len(a.path) == 0 || len(b.path) == 0 {
		t.Fatal("o corredor deve ter caminho livre de móveis")
	}
	for i := 0; i < 400; i++ {
		now = now.Add(m.options.Tick)
		r.tick(now)
		if a.X == 6 && a.Y == 1 && b.X == 1 && b.Y == 1 {
			return
		}
	}
	t.Fatalf("clientes travados no corredor: a em (%d,%d), b em (%d,%d)", a.X, a.Y, b.X, b.Y)
}

// A seated customer whose every neighbour is taken by other customers stands up anyway.
func TestSeatedCustomerBoxedInByCustomersStandsUp(t *testing.T) {
	r, m := stuckRoom([]gamewire.Unit{{ID: "chair", ItemID: 3040001, Placed: true, X: 3, Y: 3}})
	now := time.Now()
	sitter := addNPC(r, "npc:sitter", 3, 3, now)
	sitter.State, sitter.ChairID = "eating", "chair"
	r.seats["chair"] = sitter.ID
	for i, d := range neighbours {
		addNPC(r, "npc:"+string(rune('a'+i)), 3+d.X, 3+d.Y, now.Add(time.Hour)).State = "idle"
	}
	for i := 0; i < 60 && sitter.ChairID != ""; i++ {
		now = now.Add(m.options.Tick)
		r.tick(now)
	}
	if sitter.ChairID != "" || r.seats["chair"] != "" {
		t.Fatalf("o cliente cercado deveria levantar atravessando os outros: estado %s", sitter.State)
	}
}

// Furniture on every side leaves no way out: the customer eventually leaves the café
// instead of freezing a chair and the spawn limit.
func TestEnclosedCustomerGivesUp(t *testing.T) {
	units := []gamewire.Unit{{ID: "door", ItemID: 3010000, Placed: true, X: 4, Y: 0, Rotation: 1}}
	for i, d := range neighbours {
		units = append(units, gamewire.Unit{ID: "box" + string(rune('a'+i)), ItemID: 3030010, Placed: true, X: 3 + d.X, Y: 5 + d.Y})
	}
	r, m := stuckRoom(units)
	now := time.Now()
	npc := addNPC(r, "npc:boxed", 3, 5, now)
	npc.visits = 3
	for i := 0; i < 400 && r.actors[npc.ID] != nil; i++ {
		now = now.Add(m.options.Tick)
		r.tick(now)
	}
	if r.actors[npc.ID] != nil {
		t.Fatalf("o cliente encurralado pelos móveis deveria desistir; estado %s", npc.State)
	}
}

func TestWanderTargetsAreReachable(t *testing.T) {
	// A sealed 1x1 pocket at (6,6): walkable, but unreachable from the rest of the floor.
	units := []gamewire.Unit{}
	for i, d := range neighbours {
		units = append(units, gamewire.Unit{ID: "wall" + string(rune('a'+i)), ItemID: 3030010, Placed: true, X: 6 + d.X, Y: 6 + d.Y})
	}
	r, _ := stuckRoom(units)
	reachable := r.reachableTiles(Tile{X: 2, Y: 2})
	if reachable[Tile{X: 6, Y: 6}] || !reachable[Tile{X: 2, Y: 3}] {
		t.Fatal("o bolso fechado não pode ser alvo de passeio, e o resto do piso sim")
	}
}
