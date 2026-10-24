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
		zero, lastSlot := float64(0), float64(3)
		orders := core.NewBaseCollection("supply_orders")
		// One row per occupied slot of the delivery platform; collected boxes are deleted.
		orders.Fields.Add(
			&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.NumberField{Name: "slot", OnlyInt: true, Min: &zero, Max: &lastSlot},
			&core.TextField{Name: "kind", Required: true, Max: 20},
			&core.NumberField{Name: "quantity", OnlyInt: true, Min: &zero},
			&core.DateField{Name: "arrives_at", Required: true},
			&core.AutodateField{Name: "created", OnCreate: true},
		)
		orders.AddIndex("idx_supply_order_slot", true, "user, slot", "")
		if err = app.Save(orders); err != nil {
			return err
		}
		operations := core.NewBaseCollection("supply_operations")
		// Generic APIs stay closed; only the authenticated routes change orders or money.
		operations.Fields.Add(
			&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.TextField{Name: "request_key", Required: true, Max: 80},
			&core.TextField{Name: "payload", Required: true, Max: 80},
			&core.AutodateField{Name: "created", OnCreate: true},
		)
		operations.AddIndex("idx_supply_operation", true, "user, request_key", "")
		return app.Save(operations)
	}, nil)
}
