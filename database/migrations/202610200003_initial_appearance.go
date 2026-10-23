package migrations

import (
	"coffe-mania/database/appearance"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		// Only unconfigured players receive the preset; saved customization is never replaced.
		_, err := app.DB().NewQuery("UPDATE player_state SET appearance = {:look} WHERE appearance = '' OR appearance IS NULL").Bind(dbx.Params{"look": appearance.Initial()}).Execute()
		return err
	}, nil)
}
