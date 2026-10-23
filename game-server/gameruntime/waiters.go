package gameruntime

import (
	"context"
	"sort"
	"time"

	"coffe-mania/shared/gamewire"
)

func autonomous(a *entity) bool { return a.Kind == "npc" || a.Kind == "waiter" }

func (r *room) syncWaiters(saved []gamewire.Actor, now time.Time) {
	updates := []gamewire.Actor{}
	for _, employee := range r.world.Employees {
		id := "waiter:" + employee.ID
		if existing := r.actors[id]; existing != nil {
			if existing.Appearance != employee.Appearance || existing.Name != employee.Name {
				existing.Appearance, existing.Name = employee.Appearance, employee.Name
				updates = append(updates, r.status(existing, true))
			}
			continue
		}
		tile, ok := r.freeTile(Tile{X: 2, Y: 2}, id)
		if !ok {
			continue
		}
		a := &entity{Actor: gamewire.Actor{ID: id, Kind: "waiter", Name: employee.Name, Appearance: employee.Appearance, X: tile.X, Y: tile.Y, State: "waiter_idle"}}
		for _, state := range saved {
			if state.ID != id {
				continue
			}
			// Staff restart at the beginning of an unfinished step, as customers do.
			// The roster owns identity; the sleep record only owns simulation state.
			if r.grid.walkable(Tile{X: state.X, Y: state.Y}) {
				a.X, a.Y, a.Direction = state.X, state.Y, state.Direction
				a.WaiterCustomerID, a.WaiterFoodID = state.WaiterCustomerID, state.WaiterFoodID
				a.Food, a.State = state.Food, state.State
				a.path = state.Path
			}
			break
		}
		r.actors[id] = a
		r.indexActor(a)
		updates = append(updates, r.status(a, true))
	}
	if len(updates) > 0 {
		r.broadcast(gamewire.Event{Type: "actors", Actors: updates}, "")
	}
}

func (r *room) waiterReservedCustomer(id, except string) bool {
	for _, a := range r.actors {
		if a.Kind == "waiter" && a.ID != except && a.WaiterCustomerID == id {
			return true
		}
	}
	return false
}
func (r *room) waiterFoodIndex(id string) int {
	for i, food := range r.world.Foods {
		if food.ID == id {
			return i
		}
	}
	return -1
}
func (r *room) waiterReset(a *entity) {
	a.WaiterCustomerID, a.WaiterFoodID = "", ""
	a.Food, a.Action, a.path = nil, nil, nil
	a.State = "waiter_idle"
	a.stuckSince = time.Time{}
	a.blockedByActors = false
}

// Every exposed edge is a service edge, regardless of the furniture's rotation.
// Prefer the shortest unoccupied route, then fall back to geometry alone so an
// avatar can delay service but cannot trigger the trapped-waiter shortcut.
func (r *room) waiterPath(a *entity, unitID string) []Tile {
	start := Tile{X: a.X, Y: a.Y}
	var best, free []Tile
	var bestTime, freeTime time.Duration
	seen := map[Tile]bool{}
	choose := func(path []Tile, current *[]Tile, duration *time.Duration) {
		if path == nil {
			return
		}
		elapsed, from := time.Duration(0), start
		for _, to := range path {
			elapsed += stepDuration(time.Second, from, to)
			from = to
		}
		if *current == nil || elapsed < *duration {
			*current, *duration = path, elapsed
		}
	}
	for _, u := range r.world.Units {
		if !u.Placed || u.ID != unitID {
			continue
		}
		for _, tile := range footprint(u) {
			for _, d := range neighbours[:4] {
				dest := Tile{X: tile.X + d.X, Y: tile.Y + d.Y}
				if seen[dest] || !r.grid.walkable(dest) {
					continue
				}
				seen[dest] = true
				path := findPath(start, dest, r.grid.walkable, r.grid.width*r.grid.height*4)
				choose(path, &best, &bestTime)
				open := findPath(start, dest, func(t Tile) bool {
					return r.grid.walkable(t) && !r.occupied(t, a.ID)
				}, r.grid.width*r.grid.height*4)
				choose(open, &free, &freeTime)
			}
		}
	}
	if free != nil {
		return free
	}
	return best
}

func (r *room) waiterAvailableFood() int {
	best := -1
	for i, food := range r.world.Foods {
		reserved, heldByChef := 0, false
		for _, a := range r.actors {
			if a.Kind == "waiter" && a.WaiterFoodID == food.ID {
				reserved++
			}
			if a.Kind == "human" && a.Food != nil && a.Food.ID == food.ID && (a.State == "carrying" || a.State == "placing") {
				heldByChef = true
			}
		}
		if heldByChef || reserved >= max(1, food.Portions) {
			continue
		}
		if best < 0 || food.Portions > r.world.Foods[best].Portions {
			best = i
		}
	}
	return best
}

func (r *room) advanceWaiter(a *entity, now time.Time) {
	if a.Move != nil {
		return
	}
	if len(a.path) > 0 {
		// A decoration edit can seal an already assigned route. Retry the shared rule.
		valid := true
		for _, tile := range a.path {
			if !r.grid.walkable(tile) {
				valid = false
				break
			}
		}
		if valid {
			return
		}
		a.path = nil
	}
	if a.WaiterCustomerID == "" {
		if now.Before(a.due) {
			return
		}
		customers := []string{}
		for id, customer := range r.actors {
			if customer.Kind == "npc" && customer.State == "seated" && customer.TableID != "" && !r.waiterReservedCustomer(id, a.ID) {
				customers = append(customers, id)
			}
		}
		sort.Strings(customers)
		index := r.waiterAvailableFood()
		if len(customers) == 0 || index < 0 {
			return
		}
		a.WaiterCustomerID, a.WaiterFoodID = customers[0], r.world.Foods[index].ID
		a.State = "waiter_pickup"
	}
	customer := r.actors[a.WaiterCustomerID]
	index := r.waiterFoodIndex(a.WaiterFoodID)
	if customer == nil || customer.State != "seated" || customer.TableID == "" || index < 0 {
		r.waiterReset(a)
		return
	}
	food := r.world.Foods[index]
	pickup := []Tile{}
	if food.Counter != "" {
		pickup = r.waiterPath(a, food.Counter)
	}
	delivery := r.waiterPath(a, customer.TableID)
	if pickup == nil || delivery == nil {
		// Intentional Café Mania compatibility: solid enclosure serves without crossing
		// furniture. Consumption/payment still happens once, in the room's serialized turn.
		if r.deliverMeal(customer, index, now) {
			r.broadcast(gamewire.Event{Type: "actors", Actors: []gamewire.Actor{r.status(customer, false)}}, "")
		}
		r.waiterReset(a)
		a.due = now.Add(300 * time.Millisecond)
		return
	}
	path := pickup
	if a.State == "waiter_delivery" {
		path = delivery
	}
	if len(path) > 0 {
		r.route(a, path[len(path)-1], now)
		return
	}
	if a.State == "waiter_pickup" {
		a.Food = &gamewire.Food{ID: food.ID, Recipe: food.Recipe, Counter: food.Counter, Portions: 1}
		a.State = "waiter_delivery"
		a.due = now
	} else {
		if r.deliverMeal(customer, index, now) {
			r.broadcast(gamewire.Event{Type: "actors", Actors: []gamewire.Actor{r.status(customer, false)}}, "")
		}
		r.waiterReset(a)
		a.due = now.Add(300 * time.Millisecond)
	}
}

// Charge at delivery, never at pickup: an interrupted route or restart cannot lose
// a paid portion, and two workers cannot charge for the same customer's meal.
func (r *room) deliverMeal(a *entity, index int, now time.Time) bool {
	if a.State != "seated" || a.Ate || index < 0 || index >= len(r.world.Foods) {
		return false
	}
	food := r.world.Foods[index]
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	business, err := r.manager.store.Consume(ctx, r.id, food.ID)
	cancel()
	if err != nil {
		return false
	}
	r.business = business
	a.Ate = true
	if food.Portions > 1 {
		r.world.Foods[index].Portions--
	} else {
		r.world.Foods = append(r.world.Foods[:index:index], r.world.Foods[index+1:]...)
	}
	a.Food = &gamewire.Food{ID: food.ID, Recipe: food.Recipe}
	a.State = "eating"
	a.due = now.Add(8 * time.Second)
	a.Action = &gamewire.ActorAction{Kind: "eating", StartedAt: now.UnixMilli(), Duration: 8000}
	r.broadcast(gamewire.Event{Type: "food", Foods: r.world.Foods}, "")
	return true
}
