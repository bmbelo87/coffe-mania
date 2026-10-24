package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// Brazil has had no daylight saving time since 2019; suspension notices use Brasília time
// without depending on the host's time zone database.
var brasilia = time.FixedZone("BRT", -3*60*60)

func accountRole(record *core.Record) string {
	if role := record.GetString("role"); role != "" {
		return role
	}
	return "player"
}

// Staff accounts test the game: developer tools (when the server enables them) and access
// during maintenance.
func isStaff(record *core.Record) bool {
	role := accountRole(record)
	return role == "tester" || role == "admin"
}

func isAdmin(record *core.Record) bool { return accountRole(record) == "admin" }

func suspendedUntil(record *core.Record, now time.Time) (time.Time, bool) {
	until := record.GetDateTime("suspended_until")
	if until.IsZero() || !until.Time().After(now) {
		return time.Time{}, false
	}
	return until.Time(), true
}

func suspensionMessage(record *core.Record, until time.Time) string {
	message := "Sua conta está suspensa por tempo indeterminado."
	if until.Year() < 9000 {
		message = "Sua conta está suspensa até " + until.In(brasilia).Format("02/01/2006 às 15:04") + " (horário de Brasília)."
	}
	if reason := record.GetString("suspension_reason"); reason != "" {
		message += " Motivo: " + reason
	}
	return message
}

func kickUser(app core.App, user string) {
	client := roomService(app)
	if client == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := client.request(ctx, "kick", map[string]string{"User": user}, nil); err != nil {
			app.Logger().Warn("Falha ao desconectar a conta do quarto", "user", user, "error", err)
		}
	}()
}

// registerAccountHooks makes a suspension take effect at once, however it is saved (the
// PocketBase dashboard today, the admin panel later): a new token key invalidates every
// session cookie and the room service drops the open connections.
func registerAccountHooks(app core.App) {
	app.OnRecordUpdate("users").BindFunc(func(e *core.RecordEvent) error {
		original := e.Record.Original()
		_, suspended := suspendedUntil(e.Record, time.Now())
		newlySuspended := suspended && !e.Record.GetDateTime("suspended_until").Equal(original.GetDateTime("suspended_until"))
		if newlySuspended {
			e.Record.RefreshTokenKey()
		}
		roleChanged := accountRole(e.Record) != accountRole(original)
		if err := e.Next(); err != nil {
			return err
		}
		// A role change only needs a fresh room ticket (it carries the staff flag).
		if newlySuspended || roleChanged {
			kickUser(e.App, e.Record.Id)
		}
		return nil
	})
}

// revokeSessions ends the account's sessions on every device.
func revokeSessions(app core.App, record *core.Record) error {
	record.RefreshTokenKey()
	if err := app.Save(record); err != nil {
		return fmt.Errorf("revoke sessions: %w", err)
	}
	kickUser(app, record.Id)
	return nil
}

func suspendedResponse(r *core.RequestEvent, record *core.Record, until time.Time) error {
	return r.JSON(http.StatusForbidden, map[string]any{
		"status": http.StatusForbidden, "code": "suspended", "message": suspensionMessage(record, until),
	})
}
