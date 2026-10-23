package main

import (
	"database/sql"
	"errors"
	"strings"

	"coffe-mania/shared/gamewire"
	"coffe-mania/shared/recipecatalog"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// A served portion has already earned its rewards. Return its stock, not another
// reward pool. The per-customer receipt survives consumption and network retries.
func returnMeals(app core.App, owner string, meals []gamewire.MealReturn) error {
	if len(meals) > 64 {
		return errors.New("too many returned meals")
	}
	return app.RunInTransaction(func(tx core.App) error {
		for _, meal := range meals {
			if !strings.HasPrefix(meal.CustomerID, "npc:") || len(meal.CustomerID) > 60 {
				return errors.New("invalid customer")
			}
			if _, ok := recipecatalog.ByID(meal.RecipeID); !ok {
				return errUnknownRecipe
			}
			key := "meal-return:" + meal.CustomerID
			receipt, err := tx.FindFirstRecordByFilter("room_operations", "user={:user} && request_key={:key}", dbx.Params{"user": owner, "key": key})
			if err == nil {
				if receipt.GetString("payload") != meal.RecipeID {
					return errRoomOperation
				}
				continue
			}
			if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			food, err := counterForDish(tx, owner, meal.RecipeID)
			if errors.Is(err, errNoCounter) {
				// A full counter must not prevent decoration or discard the portion.
				// Legacy unassigned stock is served first by the room's existing rule.
				collection, e := tx.FindCollectionByNameOrId("room_food")
				if e != nil {
					return e
				}
				food = core.NewRecord(collection)
				food.Load(map[string]any{"user": owner, "recipe_id": meal.RecipeID, "portions": 0})
			} else if err != nil {
				return err
			}
			portions := 0
			if food.IsNew() {
				food.Set("job_id", "returned:"+owner+":"+meal.CustomerID)
			} else {
				portions = foodPortions(food)
			}
			food.Set("portions", portions+1)
			food.Set("prepaid_portions", food.GetInt("prepaid_portions")+1)
			if err = tx.Save(food); err != nil {
				return err
			}
			operations, err := tx.FindCollectionByNameOrId("room_operations")
			if err != nil {
				return err
			}
			receipt = core.NewRecord(operations)
			receipt.Load(map[string]any{"user": owner, "request_key": key, "payload": meal.RecipeID})
			if err = tx.Save(receipt); err != nil {
				return err
			}
		}
		return nil
	})
}
