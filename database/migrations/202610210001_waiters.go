package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		rooms, err := app.FindCollectionByNameOrId("player_rooms")
		if err != nil {
			return err
		}
		rooms.Fields.Add(&core.JSONField{Name: "employees", MaxSize: 32768}, &core.JSONField{Name: "waiter_actors", MaxSize: 131072})
		return app.Save(rooms)
	}, func(app core.App) error {
		rooms, err := app.FindCollectionByNameOrId("player_rooms")
		if err != nil {
			return err
		}
		rooms.Fields.RemoveByName("employees")
		rooms.Fields.RemoveByName("waiter_actors")
		return app.Save(rooms)
	})
}
