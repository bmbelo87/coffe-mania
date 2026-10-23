package gameruntime

import (
	"context"
	"testing"
	"time"

	"coffe-mania/shared/gamewire"
)

type verdictStore struct {
	Storage
	dissatisfied int
}

func (s *verdictStore) Dissatisfied(context.Context, string) (gamewire.Business, error) {
	s.dissatisfied++
	return gamewire.Business{Popularity: 797, Level: 1}, nil
}

func TestCustomerFrequencyFollowsPopularity(t *testing.T) {
	for _, c := range []struct {
		business  gamewire.Business
		perMinute int64
	}{
		{gamewire.Business{Popularity: 50, Level: 1}, 5},
		{gamewire.Business{Popularity: 149, Level: 9}, 5},
		{gamewire.Business{Popularity: 800, Level: 1}, 19},
		{gamewire.Business{Popularity: 1050, Level: 1}, 25},
		{gamewire.Business{Popularity: 800, Level: 10}, 21},
		{gamewire.Business{Popularity: 800, Level: 30}, 22},
	} {
		if got := customersPerMinute(c.business); got != c.perMinute {
			t.Fatalf("%+v: %d clientes por minuto, esperado %d", c.business, got, c.perMinute)
		}
	}
	if interval := customerInterval(gamewire.Business{Popularity: 800}); interval < 2500*time.Millisecond || interval > 3800*time.Millisecond {
		t.Fatalf("popularidade 80 traz um cliente a cada ~3,2 s; sorteado %v", interval)
	}
}

func TestLeavingCustomerIsJudgedOnce(t *testing.T) {
	store := &verdictStore{}
	r := &room{manager: &Manager{store: store}, actors: map[string]*entity{}}
	hungry := &entity{Actor: gamewire.Actor{ID: "npc:a", Kind: "npc"}}
	fed := &entity{Actor: gamewire.Actor{ID: "npc:b", Kind: "npc", Ate: true}}
	now := time.Now()
	for range 2 {
		r.judge(hungry, now)
		r.judge(fed, now)
	}
	if store.dissatisfied != 1 || r.business.Popularity != 797 {
		t.Fatalf("só quem sai sem comer perde popularidade, uma vez: %d chamadas", store.dissatisfied)
	}
	if hungry.Emotion == nil || hungry.Emotion.Kind != "dissatisfied" || fed.Emotion != nil {
		t.Fatal("quem comeu não sai com cara de insatisfeito")
	}
}

func TestSeatedCustomerGivesUpWithoutFood(t *testing.T) {
	world := gamewire.World{TilesX: 8, TilesY: 8, Units: []gamewire.Unit{
		{ID: "chair", ItemID: 3040001, Placed: true, X: 3, Y: 3, Rotation: 0},
		{ID: "table", ItemID: 3030010, Placed: true, X: 4, Y: 3},
		{ID: "door", ItemID: 3010000, Placed: true, X: 4, Y: 0, Rotation: 1},
	}}
	store := &verdictStore{}
	m := New(store, Options{})
	r := &room{manager: m, world: world, grid: newGrid(world), actors: map[string]*entity{}, peers: map[string]*Peer{}, seats: map[string]string{},
		occupancy: map[Tile]map[string]bool{}, actorTiles: map[string][]Tile{}, spawnAt: time.Now().Add(time.Hour)}
	customer := &entity{Actor: gamewire.Actor{ID: "npc:a", Kind: "npc", X: 3, Y: 4, State: "wandering"}}
	r.actors[customer.ID] = customer
	r.indexActor(customer)
	now := time.Now()
	if !r.reserveChair(customer, "chair", now) {
		t.Fatal("o cliente deve conseguir a cadeira")
	}
	for i := 0; i < 20 && customer.State != "seated"; i++ {
		now = now.Add(m.options.Step)
		r.tick(now)
	}
	if customer.State != "seated" {
		t.Fatalf("o cliente deve sentar: %s", customer.State)
	}
	sat := now
	for now.Sub(sat) < 60*time.Second && customer.State == "seated" {
		now = now.Add(m.options.Tick)
		r.tick(now)
	}
	if customer.State == "seated" {
		t.Fatalf("sem prato, o cliente levanta depois de 30 s; ainda sentado após %v (verificações %d)", now.Sub(sat), customer.visits)
	}
	if waited := now.Sub(sat); waited < 29*time.Second || waited > 31*time.Second {
		t.Fatalf("a espera sem prato deve durar 30 s, durou %v", waited)
	}
	for i := 0; i < 20 && customer.State != "leaving"; i++ {
		now = now.Add(m.options.Tick)
		r.tick(now)
	}
	if customer.State != "leaving" || customer.Emotion == nil || customer.Emotion.Kind != "dissatisfied" || store.dissatisfied != 1 {
		t.Fatalf("quem desiste sai bravo e perde popularidade uma vez: %s %+v %d", customer.State, customer.Emotion, store.dissatisfied)
	}
}
