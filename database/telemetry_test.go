package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"coffe-mania/database/playerstate"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

func newTelemetryApp(t *testing.T) (core.App, string, *telemetryRecorder) {
	t.Helper()
	app, user := newCookingTestApp(t)
	registerLedgerHooks(app)
	recorder, err := newTelemetryRecorder(app)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := playerstate.GetOrCreate(app, user); err != nil {
		t.Fatal(err)
	}
	return app, user, recorder
}

type ledgerRow struct {
	Currency string `db:"currency"`
	Delta    int64  `db:"delta"`
	Balance  int64  `db:"balance"`
	Reason   string `db:"reason"`
	Ref      string `db:"ref"`
}

func ledgerRows(t *testing.T, app core.App, recorder *telemetryRecorder) []ledgerRow {
	t.Helper()
	if err := recorder.flush(); err != nil {
		t.Fatal(err)
	}
	var rows []ledgerRow
	if err := app.AuxDB().NewQuery("SELECT currency, delta, balance, reason, ref FROM telemetry_ledger ORDER BY id").All(&rows); err != nil {
		t.Fatal(err)
	}
	return rows
}

func TestLedgerRecordsEveryChangeWithItsReason(t *testing.T) {
	app, user, recorder := newTelemetryApp(t)
	state, err := app.FindFirstRecordByData(playerstate.Collection, "user", user)
	if err != nil {
		t.Fatal(err)
	}
	gold := state.GetInt64("gold")
	state.Set("gold", gold-30)
	tagLedger(state, "cozinhar", "cookie")
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}

	// Enough XP for level 2: the level reward is its own entry, apart from the meal's profit.
	state, _ = app.FindFirstRecordByData(playerstate.Collection, "user", user)
	state.Set("gold", state.GetInt64("gold")+12)
	playerstate.GrantExperience(state, playerstate.RequiredXP(2))
	tagLedger(state, "cliente", "cookie")
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	reward := playerstate.RewardForLevel(2).Gold

	// Two saves of one record in a transaction: the second diffs against the first.
	err = app.RunInTransaction(func(tx core.App) error {
		state, err := tx.FindFirstRecordByData(playerstate.Collection, "user", user)
		if err != nil {
			return err
		}
		state.Set("cash", state.GetInt64("cash")-1)
		tagLedger(state, "tempero", "salt")
		if err := tx.Save(state); err != nil {
			return err
		}
		state.Set("cash", state.GetInt64("cash")-2)
		tagLedger(state, "tempero", "pepper")
		return tx.Save(state)
	})
	if err != nil {
		t.Fatal(err)
	}
	// A rolled back transaction leaves nothing; an untagged change is "outro".
	_ = app.RunInTransaction(func(tx core.App) error {
		state, _ := tx.FindFirstRecordByData(playerstate.Collection, "user", user)
		state.Set("gold", 0)
		tagLedger(state, "loja", "1")
		if err := tx.Save(state); err != nil {
			return err
		}
		return context.Canceled
	})
	state, _ = app.FindFirstRecordByData(playerstate.Collection, "user", user)
	state.Set("cash", state.GetInt64("cash")+5)
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}

	rows := ledgerRows(t, app, recorder)
	want := []ledgerRow{
		{"gold", -30, gold - 30, "cozinhar", "cookie"},
		{"gold", reward, gold - 30 + 12 + reward, "nivel", "2"},
		{"gold", 12, gold - 30 + 12 + reward, "cliente", "cookie"},
		{"xp", playerstate.RequiredXP(2), playerstate.RequiredXP(2), "cliente", "cookie"},
		{"level", 1, 2, "cliente", "cookie"},
		{"cash", -1, 999, "tempero", "salt"},
		{"cash", -2, 997, "tempero", "pepper"},
		{"cash", 5, 1002, "outro", ""},
	}
	if len(rows) != len(want) {
		t.Fatalf("extrato %+v", rows)
	}
	for i := range want {
		if rows[i] != want[i] {
			t.Fatalf("linha %d: %+v, esperado %+v", i, rows[i], want[i])
		}
	}
	var milestones []string
	if err := app.AuxDB().NewQuery("SELECT name FROM telemetry_milestones ORDER BY name").Column(&milestones); err != nil {
		t.Fatal(err)
	}
	if len(milestones) != 3 || milestones[0] != "first_cook" || milestones[1] != "first_meal" || milestones[2] != "level_2" {
		t.Fatalf("marcos %v", milestones)
	}
}

func TestClientTelemetryAcceptsOnlyTheClosedList(t *testing.T) {
	number := func(v float64) *float64 { return &v }
	cases := []struct {
		in clientTelemetryEvent
		ok bool
	}{
		{clientTelemetryEvent{Name: "load", Value: number(2300)}, true},
		{clientTelemetryEvent{Name: "load", Value: number(-1)}, false},
		{clientTelemetryEvent{Name: "load"}, false},
		{clientTelemetryEvent{Name: "fps", Value: number(58.36)}, true},
		{clientTelemetryEvent{Name: "screen", Label: "cook"}, true},
		{clientTelemetryEvent{Name: "screen", Label: "<script>"}, false},
		{clientTelemetryEvent{Name: "disconnect", Label: "4001"}, true},
		{clientTelemetryEvent{Name: "disconnect", Label: "abc"}, false},
		{clientTelemetryEvent{Name: "js_error", Label: "  TypeError:   x is undefined "}, true},
		{clientTelemetryEvent{Name: "js_error"}, false},
		{clientTelemetryEvent{Name: "purchase", Label: "1"}, false},
	}
	for _, c := range cases {
		if _, ok := acceptClientEvent(c.in); ok != c.ok {
			t.Errorf("%+v: aceito=%v", c.in, ok)
		}
	}
	event, _ := acceptClientEvent(clientTelemetryEvent{Name: "js_error", Label: "TypeError:   x", Source: "https://cafe.example/assets/play-abc.js?token=secreto#x", Line: 12})
	if event.Label != "TypeError: x" || event.Props["source"] != "/assets/play-abc.js" || event.Props["line"] != 12 {
		t.Fatalf("erro %+v", event)
	}
	if event, _ := acceptClientEvent(clientTelemetryEvent{Name: "fps", Value: number(58.36)}); event.Amount != 58.4 {
		t.Fatalf("fps %v", event.Amount)
	}
}

func TestTelemetryReportActivitySessionsAndRetention(t *testing.T) {
	app, user, recorder := newTelemetryApp(t)
	now := time.Date(2026, 10, 24, 15, 0, 0, 0, telemetryZone)
	today := telemetryDay(now)
	// The player signed up 8 days ago, in wave 2, and came back on days 1 and 7.
	signup := now.AddDate(0, 0, -8)
	if _, err := app.DB().NewQuery("UPDATE users SET created = {:created}, wave = 2 WHERE id = {:id}").
		Bind(dbx.Params{"created": signup.UTC().Format("2006-01-02 15:04:05.000Z"), "id": user}).Execute(); err != nil {
		t.Fatal(err)
	}
	for _, offset := range []int{0, 1, 7} {
		at := signup.AddDate(0, 0, offset)
		recorder.add(telemetryEvent{At: at, User: user, Source: "game", Name: "session_start"})
	}
	// Two connections two minutes apart are one play session; a third an hour later is another.
	end := func(at time.Time, seconds float64) {
		recorder.add(telemetryEvent{At: at, User: user, Source: "game", Name: "session_end", Amount: seconds, HasAmt: true})
	}
	start := now.Add(-3 * time.Hour)
	end(start.Add(10*time.Minute), 600)
	end(start.Add(22*time.Minute), 600)
	end(start.Add(2*time.Hour), 300)
	recorder.add(telemetryEvent{At: now, User: user, Source: "client", Name: "screen", Label: "cook"})
	if err := recorder.flush(); err != nil {
		t.Fatal(err)
	}

	report, err := buildTelemetryReport(context.Background(), app, now, 30, false)
	if err != nil {
		t.Fatal(err)
	}
	last := report.Series[len(report.Series)-1]
	if last.Day != today || last.DAU != 1 || last.Sessions != 2 || last.SessionMinutes != 27 {
		t.Fatalf("hoje %+v", last)
	}
	var wave *retentionRow
	for i := range report.Retention {
		if report.Retention[i].Wave == "2" {
			wave = &report.Retention[i]
		}
	}
	if wave == nil || wave.Users != 1 || wave.D1 != (retentionCell{1, 1}) || wave.D7 != (retentionCell{1, 1}) || wave.D30 != (retentionCell{}) {
		t.Fatalf("retenção %+v", report.Retention)
	}
	if screens := report.Usage["screens"]; len(screens) != 1 || screens[0].Label != "cook" || screens[0].Count != 1 {
		t.Fatalf("telas %+v", report.Usage)
	}

	// Past the retention, raw rows go and the day's aggregates stay.
	if err := maintainTelemetry(app, now.Add(telemetryRetention+48*time.Hour)); err != nil {
		t.Fatal(err)
	}
	var raw, daily int
	_ = app.AuxDB().NewQuery("SELECT COUNT(*) FROM telemetry_events").Row(&raw)
	_ = app.AuxDB().NewQuery("SELECT COUNT(*) FROM telemetry_daily WHERE day = {:day} AND metric = 'play_session'").Bind(dbx.Params{"day": today}).Row(&daily)
	if raw != 0 || daily != 1 {
		t.Fatalf("brutos %d, agregados de hoje %d", raw, daily)
	}
}

func TestDeletedAccountLosesItsTelemetry(t *testing.T) {
	app, user, recorder := newTelemetryApp(t)
	recorder.add(telemetryEvent{At: time.Now(), User: user, Source: "server", Name: "login"})
	state, _ := app.FindFirstRecordByData(playerstate.Collection, "user", user)
	state.Set("gold", 1)
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	if err := recorder.flush(); err != nil {
		t.Fatal(err)
	}
	// Queued after the flush, before the deletion: must not survive either.
	recorder.add(telemetryEvent{At: time.Now(), User: user, Source: "client", Name: "screen", Label: "store"})
	exported, err := exportTelemetry(app, user)
	if err != nil {
		t.Fatal(err)
	}
	if data, _ := json.Marshal(exported); !strings.Contains(string(data), `"name":"login"`) || !strings.Contains(string(data), `"currency":"gold"`) {
		t.Fatalf("exportação %s", data)
	}
	if err := forgetTelemetryUser(app, user); err != nil {
		t.Fatal(err)
	}
	recorder.add(telemetryEvent{At: time.Now(), User: user, Source: "game", Name: "session_end", Amount: 10, HasAmt: true})
	if err := recorder.flush(); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"telemetry_events", "telemetry_ledger", "telemetry_activity", "telemetry_milestones"} {
		var count int
		_ = app.AuxDB().NewQuery("SELECT COUNT(*) FROM " + table).Row(&count)
		if count != 0 {
			t.Fatalf("%s: %d linhas", table, count)
		}
	}
}
