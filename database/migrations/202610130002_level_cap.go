package migrations

import (
	"fmt"

	"coffe-mania/database/playerstate"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// The level field was created capped at 150, while the level table goes to 260. Saving
// level 151 failed validation, so the whole experience grant was rejected and the player
// stopped earning XP. Some databases recorded 202610090003 without the cap being lifted,
// so this migration re-applies it and fails loudly if the field cannot be found.
func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId(playerstate.Collection)
		if err != nil {
			return err
		}
		field, ok := collection.Fields.GetByName("level").(*core.NumberField)
		if !ok {
			return fmt.Errorf("player_state.level não é um campo numérico")
		}
		maxLevel := float64(playerstate.MaxLevel())
		if field.Max != nil && *field.Max >= maxLevel {
			return nil
		}
		field.Max = &maxLevel
		return app.Save(collection)
	}, nil)
}
