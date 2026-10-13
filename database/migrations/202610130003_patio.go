package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// The patio sold by the "Terreno à venda" sign: its floor size beyond the café's front-left
// edge. Existing rooms start without one (0x0).
func init() {
	m.Register(func(app core.App) error {
		rooms, err := app.FindCollectionByNameOrId("player_rooms")
		if err != nil {
			return err
		}
		minimum, maximum := float64(0), float64(40)
		for _, name := range []string{"patio_x", "patio_y"} {
			if rooms.Fields.GetByName(name) == nil {
				rooms.Fields.Add(&core.NumberField{Name: name, OnlyInt: true, Min: &minimum, Max: &maximum})
			}
		}
		return app.Save(rooms)
	}, nil)
}
