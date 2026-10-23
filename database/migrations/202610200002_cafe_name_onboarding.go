package migrations

import (
	"coffe-mania/database/playerstate"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId(playerstate.Collection)
		if err != nil {
			return err
		}
		collection.Fields.Add(&core.BoolField{Name: "cafe_name_chosen"})
		if err := app.Save(collection); err != nil {
			return err
		}
		// Preserve custom names; the provisioned default still needs confirmation.
		_, err = app.DB().NewQuery("UPDATE player_state SET cafe_name_chosen = true WHERE cafe_name != '' AND cafe_name != {:default}").Bind(dbx.Params{"default": playerstate.DefaultCafeName}).Execute()
		return err
	}, nil)
}
