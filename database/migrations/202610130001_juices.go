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
		state := core.NewBaseCollection("juice_state")
		state.Fields.Add(&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true}, &core.BoolField{Name: "unlocked"}, &core.JSONField{Name: "stock", MaxSize: 16384}, &core.JSONField{Name: "mastery", MaxSize: 4096}, &core.DateField{Name: "energy_at"})
		state.AddIndex("idx_juice_user", true, "user", "")
		if err = app.Save(state); err != nil {
			return err
		}
		operations := core.NewBaseCollection("juice_operations")
		// Generic APIs stay closed. Only authenticated, room-serialized operations change stock or money.
		operations.Fields.Add(&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true}, &core.TextField{Name: "request_key", Required: true, Max: 80}, &core.TextField{Name: "payload", Required: true, Max: 80}, &core.AutodateField{Name: "created", OnCreate: true})
		operations.AddIndex("idx_juice_operation", true, "user, request_key", "")
		return app.Save(operations)
	}, nil)
}
