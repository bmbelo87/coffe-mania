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
		zero := float64(0)
		// Signup records which legal text the player accepted and the 18+ confirmation.
		users.Fields.Add(
			&core.TextField{Name: "terms_version", Max: 40},
			&core.DateField{Name: "terms_accepted_at"},
			&core.DateField{Name: "adult_confirmed_at"},
			&core.NumberField{Name: "wave", OnlyInt: true, Min: &zero},
			// Invites a player may give to friends; zero during the first waves.
			&core.NumberField{Name: "invites_left", OnlyInt: true, Min: &zero},
			&core.DateField{Name: "reset_sent_at"},
		)
		if err = app.Save(users); err != nil {
			return err
		}

		// Generic APIs stay closed on every collection below; only /api/coffe routes use them.
		waitlist := core.NewBaseCollection("waitlist")
		waitlist.Fields.Add(
			&core.EmailField{Name: "email", Required: true},
			&core.TextField{Name: "name", Required: true, Max: 60},
			&core.TextField{Name: "memory", Max: 500},
			&core.SelectField{Name: "status", Values: []string{"pending", "confirmed", "invited", "joined"}, MaxSelect: 1, Required: true},
			&core.TextField{Name: "confirm_hash", Max: 64, Hidden: true},
			&core.DateField{Name: "confirm_sent_at"},
			&core.DateField{Name: "confirmed_at"},
			&core.DateField{Name: "invited_at"},
			&core.TextField{Name: "privacy_version", Max: 40},
			&core.AutodateField{Name: "created", OnCreate: true},
		)
		waitlist.AddIndex("idx_waitlist_email", true, "email", "")
		waitlist.AddIndex("idx_waitlist_queue", false, "status, confirmed_at", "")
		if err = app.Save(waitlist); err != nil {
			return err
		}

		invites := core.NewBaseCollection("invites")
		invites.Fields.Add(
			// Only the SHA-256 of the code is stored; the code itself travels in the email.
			&core.TextField{Name: "code_hash", Required: true, Max: 64, Hidden: true},
			&core.EmailField{Name: "email", Required: true},
			&core.NumberField{Name: "wave", OnlyInt: true, Min: &zero},
			&core.SelectField{Name: "source", Values: []string{"waitlist", "admin", "friend"}, MaxSelect: 1, Required: true},
			&core.DateField{Name: "expires_at", Required: true},
			&core.DateField{Name: "used_at"},
			&core.RelationField{Name: "user", CollectionId: users.Id, MaxSelect: 1, CascadeDelete: true},
			&core.RelationField{Name: "created_by", CollectionId: users.Id, MaxSelect: 1},
			&core.AutodateField{Name: "created", OnCreate: true},
		)
		invites.AddIndex("idx_invite_code", true, "code_hash", "")
		invites.AddIndex("idx_invite_email", false, "email", "")
		if err = app.Save(invites); err != nil {
			return err
		}

		// Development only: messages are kept here instead of being sent (database/mailer.go).
		mailbox := core.NewBaseCollection("dev_mailbox")
		mailbox.Fields.Add(
			&core.TextField{Name: "to", Required: true, Max: 254},
			&core.TextField{Name: "kind", Max: 40},
			&core.TextField{Name: "subject", Max: 200},
			&core.TextField{Name: "link", Max: 500},
			&core.TextField{Name: "html"},
			&core.AutodateField{Name: "created", OnCreate: true},
		)
		if err = app.Save(mailbox); err != nil {
			return err
		}

		settings := app.Settings()
		// Paths ending in "/" are prefixes. Counts are per client IP (the proxy's real IP in
		// production, see database/production.go).
		settings.RateLimits.Rules = append([]core.RateLimitRule{
			{Label: "/api/coffe/waitlist", MaxRequests: 5, Duration: 60},
			{Label: "/api/coffe/waitlist/", MaxRequests: 10, Duration: 60},
			{Label: "/api/coffe/invite/", MaxRequests: 20, Duration: 60},
			{Label: "/api/coffe/signup", MaxRequests: 10, Duration: 60},
			{Label: "/api/coffe/password/", MaxRequests: 5, Duration: 60},
			{Label: "/api/coffe/account/", MaxRequests: 10, Duration: 60},
		}, settings.RateLimits.Rules...)
		return app.Save(settings)
	}, nil)
}
