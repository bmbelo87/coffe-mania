package gameruntime

import (
	"coffe-mania/shared/gamewire"
	"coffe-mania/shared/roomcatalog"
	"time"
)

// Preview selection has no financial side effects. The legacy transactional meal-return
// operation remains separate; a served meal in the finish-and-leave flow is consumed normally.
func (r *room) claimTableEdit(owner *entity, id string) string {
	if id == "" {
		owner.editingTable = ""
		return ""
	}
	for _, u := range r.world.Units {
		item, _ := roomcatalog.ByID(u.ItemID)
		if u.ID == id && u.Placed && item.Kind == "table" {
			owner.editingTable = id
			return ""
		}
	}
	return "Mesa indisponível."
}

func decorationSeated(state string) bool {
	return state == "seated" || state == "eating" || state == "thirsty" || state == "drinking"
}

// This hook is reached only after a successful persistent world update. It never charges,
// refunds, deletes a meal in progress, or changes an eating/drinking action's deadline.
func (r *room) prepareDecorationChanges(next gamewire.World, now time.Time) {
	changed := map[string]bool{}
	previous := map[string]Unit{}
	for _, u := range r.world.Units {
		if u.Placed {
			previous[u.ID] = u
		}
	}
	targets := []Unit{}
	for _, u := range next.Units {
		old, exists := previous[u.ID]
		delete(previous, u.ID)
		if exists && u.Placed && old.X == u.X && old.Y == u.Y && old.Rotation == u.Rotation && old.ItemID == u.ItemID {
			continue
		}
		if exists {
			changed[u.ID] = true
		}
		item, _ := roomcatalog.ByID(u.ItemID)
		if u.Placed && item.Type >= 2 && item.Kind != "wall" && item.Kind != "window" && item.Kind != "panel" {
			targets = append(targets, u)
		}
	}
	for id := range previous {
		changed[id] = true
	}
	if len(changed) == 0 && len(targets) == 0 {
		return
	}
	updates := []gamewire.Actor{}
	for _, a := range r.actors {
		if a.Kind != "npc" || a.DecorationExit {
			continue
		}
		affected := changed[a.ChairID] || changed[a.TableID]
		for _, u := range targets {
			for _, t := range footprint(u) {
				affected = affected || (a.X == t.X && a.Y == t.Y) || (a.Move != nil && (a.Move.From == t || a.Move.To == t))
			}
		}
		if !affected {
			continue
		}
		if decorationSeated(a.State) {
			for _, u := range r.world.Units {
				if u.ID == a.ChairID {
					copy := u
					a.DetachedChair = &copy
				}
				if u.ID == a.TableID {
					copy := u
					a.DetachedTable = &copy
				}
			}
		}
		if r.seats[a.ChairID] == a.ID {
			delete(r.seats, a.ChairID)
		}
		a.ChairID, a.TableID = "", ""
		a.DecorationExit, a.Judged = true, true
		a.Emotion = nil
		clearBeverageRequests(a)
		a.path = nil // Preserve an already-started step and its calibrated half-step transition.
		a.stuckSince = time.Time{}
		if a.State != "eating" && a.State != "drinking" {
			a.State = "decoration_leaving"
			a.Action = nil
			a.due = now
		}
		for _, waiter := range r.actors {
			if waiter.Kind == "waiter" && waiter.WaiterCustomerID == a.ID {
				r.waiterReset(waiter)
				updates = append(updates, r.status(waiter, false))
			}
		}
		updates = append(updates, r.status(a, false))
	}
	if len(updates) > 0 {
		r.broadcast(gamewire.Event{Type: "actors", Actors: updates}, "")
	}
}

func (r *room) advanceDecorationExit(a *entity, now time.Time) bool {
	if a.State == "leaving" {
		if a.Outside {
			return true
		}
		r.exitNPC(a, now)
		return false
	}
	// The room tick calls this only after the unchanged action deadline has elapsed.
	a.DetachedChair, a.DetachedTable = nil, nil
	r.releaseSeat(a)
	a.Action = nil
	if a.Outside {
		return true
	}
	if _, ok := r.grid.door(); !ok {
		return true
	}
	a.State = "decoration_leaving"
	if !r.grid.walkable(Tile{X: a.X, Y: a.Y}) {
		dest, ok := r.freeNeighbour(Tile{X: a.X, Y: a.Y}, a, true)
		if !ok {
			return true
		} // A fully sealed layout cannot retain a finished customer.
		r.route(a, dest, now)
		a.due = now.Add(time.Second)
		return false
	}
	r.exitNPC(a, now)
	return false
}
