package gameruntime

import (
	"testing"

	"coffe-mania/shared/gamewire"
)

func TestGridCoversTheCafeAndItsPatio(t *testing.T) {
	g := newGrid(gamewire.World{TilesX: 7, TilesY: 10, PatioX: 4, PatioY: 4})
	cases := []struct {
		tile Tile
		want bool
	}{
		{Tile{X: 6, Y: 9}, true},   // café front corner
		{Tile{X: 4, Y: 13}, true},  // patio far corner
		{Tile{X: 5, Y: 11}, false}, // beside the patio
		{Tile{X: 0, Y: 11}, false}, // the wall column does not continue along the patio
		{Tile{X: 2, Y: 14}, false}, // past the patio
	}
	for _, c := range cases {
		if got := g.walkable(c.tile); got != c.want {
			t.Fatalf("%+v: %v", c.tile, got)
		}
	}
	g.resize(gamewire.World{TilesX: 8, TilesY: 10, PatioX: 7, PatioY: 6})
	if !g.walkable(Tile{X: 7, Y: 15}) {
		t.Fatal("the larger patio is walkable after the update")
	}
}
