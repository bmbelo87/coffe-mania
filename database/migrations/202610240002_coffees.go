package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		state := core.NewBaseCollection("coffee_state")
		state.Fields.Add(&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.JSONField{Name: "selected", MaxSize: 16384}, &core.JSONField{Name: "mastery", MaxSize: 8192})
		state.AddIndex("idx_coffee_user", true, "user", "")
		if err = app.Save(state); err != nil {
			return err
		}
		operations := core.NewBaseCollection("coffee_operations")
		// Generic collection APIs remain closed; only serialized authenticated operations may debit or reward.
		operations.Fields.Add(&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.TextField{Name: "request_key", Required: true, Max: 80}, &core.TextField{Name: "payload", Required: true, Max: 80},
			&core.AutodateField{Name: "created", OnCreate: true})
		operations.AddIndex("idx_coffee_operation", true, "user, request_key", "")
		if err = app.Save(operations); err != nil {
			return err
		}
		rewards := core.NewBaseCollection("coffee_rewards")
		rewards.Fields.Add(&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.TextField{Name: "recipe_id", Required: true, Max: 80}, &core.TextField{Name: "reward_name", Required: true, Max: 120},
			&core.BoolField{Name: "delivered"}, &core.DateField{Name: "eligible_at"})
		rewards.AddIndex("idx_coffee_reward", true, "user, recipe_id", "")
		return app.Save(rewards)
	}, nil)
}
