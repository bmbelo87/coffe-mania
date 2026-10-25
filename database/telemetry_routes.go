package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"coffe-mania/shared/gamewire"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Screens the client may report; anything else is dropped (game/src/core/telemetry.ts).
var telemetryScreens = map[string]bool{
	"cook": true, "spices": true, "waiters": true, "wardrobe": true, "store": true, "supplies": true,
	"juices": true, "invite": true, "settings": true, "expansion": true,
}

var telemetrySession = regexp.MustCompile(`^[A-Za-z0-9-]{8,40}$`)

// clientTelemetryEvent is one entry of a client batch. Only the fields of each event's
// schema below are kept; the rest of the payload is ignored.
type clientTelemetryEvent struct {
	Name   string   `json:"name"`
	Label  string   `json:"label"`
	Value  *float64 `json:"value"`
	Source string   `json:"source"`
	Line   int      `json:"line"`
}

func clip(value string, limit int) string {
	value = strings.Join(strings.Fields(value), " ")
	if utf8.RuneCountInString(value) <= limit {
		return value
	}
	return string([]rune(value)[:limit])
}

// scriptPath keeps only the path of a script URL: no origin, query or fragment, which could
// carry tokens.
func scriptPath(source string) string {
	if index := strings.IndexAny(source, "?#"); index >= 0 {
		source = source[:index]
	}
	if index := strings.Index(source, "://"); index >= 0 {
		if slash := strings.Index(source[index+3:], "/"); slash >= 0 {
			source = source[index+3+slash:]
		} else {
			source = ""
		}
	}
	return clip(source, 120)
}

// acceptClientEvent applies the closed list of client events. It returns false for unknown
// events and out-of-range values, which are dropped without failing the batch: an old page
// may still send an event that was removed.
func acceptClientEvent(in clientTelemetryEvent) (telemetryEvent, bool) {
	value := func(minimum, maximum float64) (float64, bool) {
		if in.Value == nil || math.IsNaN(*in.Value) || *in.Value < minimum || *in.Value > maximum {
			return 0, false
		}
		return math.Round(*in.Value*10) / 10, true
	}
	out := telemetryEvent{Source: "client", Name: in.Name}
	switch in.Name {
	case "load": // milliseconds from opening the page to the café on screen
		amount, ok := value(0, 600000)
		if !ok {
			return out, false
		}
		out.Amount, out.HasAmt = amount, true
	case "fps": // average frames per second over the last minute
		amount, ok := value(0, 1000)
		if !ok {
			return out, false
		}
		out.Amount, out.HasAmt = amount, true
	case "js_error":
		out.Label = clip(in.Label, 160)
		if out.Label == "" {
			return out, false
		}
		out.Props = map[string]any{"source": scriptPath(in.Source), "line": max(0, min(in.Line, 1_000_000))}
	case "disconnect": // WebSocket close code
		code, err := strconv.Atoi(in.Label)
		if err != nil || code < 1000 || code > 4999 {
			return out, false
		}
		out.Label = strconv.Itoa(code)
	case "screen":
		if !telemetryScreens[in.Label] {
			return out, false
		}
		out.Label = in.Label
	default:
		return out, false
	}
	return out, true
}

func registerTelemetry(e *core.ServeEvent) error {
	recorder, err := newTelemetryRecorder(e.App)
	if err != nil {
		return err
	}
	recorder.start()
	e.App.OnTerminate().BindFunc(func(te *core.TerminateEvent) error {
		if err := recorder.close(); err != nil {
			te.App.Logger().Warn("Não foi possível gravar a telemetria no encerramento", "error", err)
		}
		return te.Next()
	})
	// Days are rolled up at 00:10 in Brasília (03:10 UTC), then raw rows past the retention go.
	// A startup run catches up on days missed while the server was down.
	maintain := func() {
		if err := maintainTelemetry(e.App, time.Now()); err != nil {
			e.App.Logger().Warn("Falha na rotina diária da telemetria", "error", err)
		}
	}
	go maintain()
	e.App.Cron().MustAdd("coffe_telemetry_daily", "10 3 * * *", maintain)
	// Players and rooms online, every 5 minutes, for the history of the "now" panel.
	e.App.Cron().MustAdd("coffe_telemetry_online", "*/5 * * * *", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		metrics, err := gameMetrics(ctx, e.App)
		if err != nil {
			return
		}
		recorder.add(telemetryEvent{At: time.Now(), Source: "game", Name: "online", Amount: metrics.Players, HasAmt: true,
			Props: map[string]any{"rooms": metrics.Rooms, "connections": metrics.Connections}})
	})

	e.Router.POST("/api/coffe/telemetry", func(r *core.RequestEvent) error {
		user := sessionRecord(r)
		if user == nil {
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		var body struct {
			Session string                 `json:"session"`
			Events  []clientTelemetryEvent `json:"events"`
		}
		if r.BindBody(&body) != nil || !telemetrySession.MatchString(body.Session) || len(body.Events) > 60 {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		now := time.Now()
		accepted := make([]telemetryEvent, 0, len(body.Events))
		for _, in := range body.Events {
			if event, ok := acceptClientEvent(in); ok {
				event.At, event.User, event.Session = now, user.Id, body.Session
				accepted = append(accepted, event)
			}
		}
		recorder.add(accepted...)
		return r.JSON(http.StatusAccepted, map[string]int{"accepted": len(accepted)})
	}).Bind(apis.BodyLimit(16384)).BindFunc(sameOrigin)

	e.Router.POST("/api/coffe/game-internal/telemetry", func(r *core.RequestEvent) error {
		if !internalSecret(r) {
			return r.ForbiddenError("Acesso restrito.", nil)
		}
		var events []gamewire.TelemetryEvent
		if r.BindBody(&events) != nil || len(events) > 2000 {
			return r.BadRequestError("Inválido.", nil)
		}
		accepted := make([]telemetryEvent, 0, len(events))
		for _, in := range events {
			if in.Name != "session_start" && in.Name != "session_end" || in.User == "" || len(in.User) > 40 || len(in.Session) > 40 {
				continue
			}
			at := time.UnixMilli(in.At)
			if in.At <= 0 || time.Since(at) > time.Hour || time.Until(at) > time.Minute {
				at = time.Now()
			}
			event := telemetryEvent{At: at, User: in.User, Session: in.Session, Source: "game", Name: in.Name, Label: clip(in.Label, 20)}
			if in.Name == "session_end" {
				event.Amount, event.HasAmt = math.Round(max(0, min(in.Seconds, 7*24*3600))), true
			}
			accepted = append(accepted, event)
		}
		recorder.add(accepted...)
		// Written before answering: the room service keeps a batch until it is acknowledged,
		// so the end of a session survives this process being stopped right after.
		if err := recorder.flush(); err != nil {
			return r.Error(http.StatusServiceUnavailable, "Telemetria indisponível.", err)
		}
		return r.JSON(http.StatusOK, map[string]int{"accepted": len(accepted)})
	}).Bind(apis.BodyLimit(262144))

	e.Router.GET("/api/coffe/admin/metrics", func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		days, _ := strconv.Atoi(r.Request.URL.Query().Get("days"))
		if days != 7 && days != 30 && days != 90 {
			days = 30
		}
		report, err := buildTelemetryReport(r.Request.Context(), r.App, time.Now(), days, r.Request.URL.Query().Get("staff") == "1")
		if err != nil {
			return r.InternalServerError("Não foi possível montar as métricas.", err)
		}
		return r.JSON(http.StatusOK, report)
	}).BindFunc(requireAdmin)
	return nil
}

// internalSecret repeats the game-internal group's check for routes registered outside it.
func internalSecret(r *core.RequestEvent) bool {
	client := roomService(r.App)
	return client != nil && subtle.ConstantTimeCompare([]byte(r.Request.Header.Get("Authorization")), []byte("Bearer "+client.Secret)) == 1
}

type liveGameMetrics struct {
	Players     float64        `json:"players"`
	Rooms       float64        `json:"rooms"`
	Connections float64        `json:"connections"`
	Tick        map[string]any `json:"tick"`
	Task        map[string]any `json:"task"`
	Available   bool           `json:"available"`
}

// gameMetrics reads the room service's live counters (game-server /internal/metrics).
func gameMetrics(ctx context.Context, app core.App) (liveGameMetrics, error) {
	var out liveGameMetrics
	client := roomService(app)
	if client == nil {
		return out, fmt.Errorf("room service not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, client.URL+"/internal/metrics", nil)
	if err != nil {
		return out, err
	}
	req.Header.Set("Authorization", "Bearer "+client.Secret)
	res, err := client.HTTP.Do(req)
	if err != nil {
		return out, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return out, fmt.Errorf("room service metrics: HTTP %d", res.StatusCode)
	}
	if err = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&out); err != nil {
		return out, err
	}
	out.Available = true
	return out, nil
}

// forgetTelemetryUser erases a deleted account's rows: raw events, ledger, activity days and
// milestones, plus anything still queued. Daily aggregates carry no account id and stay.
func forgetTelemetryUser(app core.App, user string) error {
	recorder := telemetryOf(app)
	if recorder == nil {
		return nil
	}
	recorder.forget(user)
	return app.AuxRunInTransaction(func(tx core.App) error {
		for _, table := range []string{"telemetry_events", "telemetry_ledger", "telemetry_activity", "telemetry_milestones"} {
			if _, err := tx.AuxDB().NewQuery("DELETE FROM " + table + " WHERE user_id = {:user}").Bind(dbx.Params{"user": user}).Execute(); err != nil {
				return err
			}
		}
		return nil
	})
}

// exportTelemetry returns the account's raw telemetry for the data export (LGPD).
func exportTelemetry(app core.App, user string) (map[string]any, error) {
	if telemetryOf(app) == nil {
		return nil, nil
	}
	type eventRow struct {
		At     int64         `db:"at" json:"at"`
		Source string        `db:"source" json:"source"`
		Name   string        `db:"name" json:"name"`
		Label  string        `db:"label" json:"label,omitempty"`
		Amount *float64      `db:"amount" json:"amount,omitempty"`
		Props  types.JSONRaw `db:"props" json:"props,omitempty"`
	}
	type ledgerRow struct {
		At       int64  `db:"at" json:"at"`
		Currency string `db:"currency" json:"currency"`
		Delta    int64  `db:"delta" json:"delta"`
		Balance  int64  `db:"balance" json:"balance"`
		Reason   string `db:"reason" json:"reason"`
		Ref      string `db:"ref" json:"ref,omitempty"`
	}
	var events []eventRow
	var ledger []ledgerRow
	var days []string
	db := app.AuxDB()
	params := dbx.Params{"user": user}
	if err := db.NewQuery("SELECT at, source, name, label, amount, props FROM telemetry_events WHERE user_id = {:user} ORDER BY at DESC LIMIT 20000").Bind(params).All(&events); err != nil {
		return nil, err
	}
	if err := db.NewQuery("SELECT at, currency, delta, balance, reason, ref FROM telemetry_ledger WHERE user_id = {:user} ORDER BY at DESC LIMIT 20000").Bind(params).All(&ledger); err != nil {
		return nil, err
	}
	if err := db.NewQuery("SELECT day FROM telemetry_activity WHERE user_id = {:user} ORDER BY day").Bind(params).Column(&days); err != nil {
		return nil, err
	}
	return map[string]any{"events": events, "ledger": ledger, "activeDays": days}, nil
}

func (t *telemetryRecorder) forget(user string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	events := t.events[:0]
	for _, event := range t.events {
		if event.User != user {
			events = append(events, event)
		}
	}
	ledger := t.ledger[:0]
	for _, entry := range t.ledger {
		if entry.User != user {
			ledger = append(ledger, entry)
		}
	}
	t.events, t.ledger = events, ledger
	// The room service still reports the session the deletion closed; ignore the account for
	// a while so that report does not bring its rows back.
	if t.forgotten == nil {
		t.forgotten = map[string]time.Time{}
	}
	now := time.Now()
	for id, at := range t.forgotten {
		if now.Sub(at) > 10*time.Minute {
			delete(t.forgotten, id)
		}
	}
	t.forgotten[user] = now
}
