package migrations

import (
	"coffe-mania/database/playerstate"
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId(playerstate.Collection)
		if err != nil {
			return err
		}
		// Existing players start with an empty queue; historical levels are never paid again.
		collection.Fields.Add(&core.JSONField{Name: "level_notifications", MaxSize: 262144})
		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId(playerstate.Collection)
		if err != nil {
			return err
		}
		collection.Fields.RemoveByName("level_notifications")
		return app.Save(collection)
	})
}
