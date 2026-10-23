package gameruntime

import (
	"context"
	"encoding/json"
	"time"

	"coffe-mania/shared/gamewire"
	"coffe-mania/shared/roomcatalog"
)

func (r *room) tableBeingEdited(id string) bool {
	if id == "" {
		return false
	}
	for _, a := range r.actors {
		if a.editingTable == id {
			return true
		}
	}
	return false
}

// The room queue serializes the refund, customer removal and table claim. A failed
// persistent refund leaves the customer and their meal intact for a safe retry.
func (r *room) prepareTableEdit(owner *entity, id string) string {
	if id == "" {
		owner.editingTable = ""
		return ""
	}
	found := false
	for _, u := range r.world.Units {
		item, _ := roomcatalog.ByID(u.ItemID)
		if u.ID == id && u.Placed && item.Kind == "table" {
			found = true
			break
		}
	}
	if !found {
		return "Mesa indisponível."
	}
	removed := []string{}
	meals := []gamewire.MealReturn{}
	for _, a := range r.actors {
		if a.TableID != id {
			continue
		}
		if a.Kind != "npc" {
			return "Esta mesa está sendo usada por outro jogador."
		}
		removed = append(removed, a.ID)
		if a.State == "eating" && a.Food != nil {
			meals = append(meals, gamewire.MealReturn{CustomerID: a.ID, RecipeID: a.Food.Recipe})
		}
	}
	if len(meals) > 0 {
		body, _ := json.Marshal(meals)
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		result, err := r.manager.store.Operate(ctx, gamewire.Operation{Owner: r.id, User: r.id, Action: "return_meals", Body: body})
		if err != nil || result.Status < 200 || result.Status >= 300 || result.World == nil {
			return "Não foi possível devolver o prato. Tente novamente."
		}
		r.updateWorld(*result.World)
	}
	changed := []gamewire.Actor{}
	for _, id := range removed {
		for _, waiter := range r.actors {
			if waiter.Kind == "waiter" && waiter.WaiterCustomerID == id {
				r.waiterReset(waiter)
				changed = append(changed, r.status(waiter, false))
			}
		}
		r.releaseSeat(r.actors[id])
		delete(r.actors, id)
		r.unindexActor(id)
	}
	owner.editingTable = id
	if len(removed) > 0 {
		r.broadcast(gamewire.Event{Type: "actors", Removed: removed, Actors: changed}, "")
	}
	return ""
}
