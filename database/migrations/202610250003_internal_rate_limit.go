package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		settings := app.Settings()
		// The room service calls these routes from 127.0.0.1 for every room (presence, sales,
		// customers). PocketBase's default "/api/" rule counts per IP, and with hundreds of
		// active cafés it answered 429: joins failed and meals were not recorded (load test of
		// 24/10/2026). The routes require the shared secret and the proxy blocks them from
		// outside, so they get a limit that is never reached. Prefix rules are checked in list
		// order, so this one goes first.
		settings.RateLimits.Rules = append([]core.RateLimitRule{
			{Label: "/api/coffe/game-internal/", MaxRequests: 1_000_000, Duration: 1},
		}, settings.RateLimits.Rules...)
		return app.Save(settings)
	}, nil)
}
