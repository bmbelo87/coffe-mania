package migrations

import (
	"database/sql"
	"errors"
	"os"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// StatusRecordID is the single row of game_status (see database/operation_status.go).
const StatusRecordID = "gamestatus00001"

func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		// Empty role means "player". Staff (tester/admin) gets developer tools on servers that
		// enable them and keeps access during maintenance.
		users.Fields.Add(
			&core.SelectField{Name: "role", Values: []string{"player", "tester", "admin"}, MaxSelect: 1},
			&core.DateField{Name: "suspended_until"},
			&core.TextField{Name: "suspension_reason", Max: 300},
		)
		if err = app.Save(users); err != nil {
			return err
		}
		if os.Getenv("COFFE_DEV_SEED") == "true" {
			if record, err := app.FindAuthRecordByEmail("users", "test@local.mail"); err == nil {
				record.Set("role", "admin")
				if err = app.Save(record); err != nil {
					return err
				}
			} else if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
		}

		status := core.NewBaseCollection("game_status")
		// Read through /api/coffe/status; only superusers and admin routes change it.
		status.Fields.Add(
			&core.SelectField{Name: "mode", Values: []string{"open", "maintenance", "closed"}, MaxSelect: 1, Required: true},
			&core.TextField{Name: "message", Max: 500},
			&core.DateField{Name: "starts_at"},
			&core.DateField{Name: "ends_at"},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)
		if err = app.Save(status); err != nil {
			return err
		}
		record := core.NewRecord(status)
		record.Id = StatusRecordID
		record.Set("mode", "open")
		return app.Save(record)
	}, nil)
}
