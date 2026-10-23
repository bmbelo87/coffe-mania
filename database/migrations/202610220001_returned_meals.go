package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		foods, err := app.FindCollectionByNameOrId("room_food")
		if err != nil {
			return err
		}
		foods.Fields.Add(&core.NumberField{Name: "prepaid_portions", OnlyInt: true, Min: ptrFloat(0)})
		return app.Save(foods)
	}, func(app core.App) error {
		foods, err := app.FindCollectionByNameOrId("room_food")
		if err != nil {
			return err
		}
		foods.Fields.RemoveByName("prepaid_portions")
		return app.Save(foods)
	})
}

func ptrFloat(value float64) *float64 { return &value }
