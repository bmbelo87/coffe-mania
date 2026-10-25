package main

import (
	"encoding/json"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"coffe-mania/database/playerstate"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Telemetry is first-party: rows stay in PocketBase's auxiliary database (auxiliary.db), apart
// from the game's data.db, and nothing is sent to third parties. Writes are batched every few
// seconds so they never compete with the game's transactions. Raw rows are kept for
// telemetryRetention; daily aggregates, activity days and milestones are kept for good.
// What is collected must match the Privacy Policy (game/src/auth/legal.ts).

const (
	telemetryRetention = 90 * 24 * time.Hour
	telemetryFlushEach = 5 * time.Second
	// Past this many queued rows new ones are dropped (and counted) instead of growing memory.
	telemetryQueueLimit = 20000
)

// Brasília has no daylight saving time since 2019: days are cut at midnight UTC−3, like the
// suspension messages.
var telemetryZone = time.FixedZone("BRT", -3*60*60)

func telemetryDay(t time.Time) string { return t.In(telemetryZone).Format("2006-01-02") }

type telemetryEvent struct {
	At      time.Time
	User    string
	Session string
	Source  string // "server", "game" (room service) or "client"
	Name    string
	Label   string // the event's main dimension: recipe, screen, close code, error message…
	Amount  float64
	HasAmt  bool
	Props   map[string]any
}

// ledgerEntry is one change of caféGranas ("cash"), caféOuros ("gold") or XP of a player,
// with the action that caused it.
type ledgerEntry struct {
	At       time.Time
	User     string
	Currency string
	Delta    int64
	Balance  int64
	Reason   string
	Ref      string
}

// Events that show the player was playing that day (DAU and retention). Effects of other
// people's actions, such as a visitor's customers paying the owner, do not count.
var activeEvents = map[string]bool{"login": true, "session_start": true, "session_end": true}

// Milestones of the funnel, kept per account for good. Level milestones come from level_up.
var milestoneEvents = map[string]string{"cafe_named": "cafe_named"}
var milestoneLedger = map[string]string{"cozinhar": "first_cook", "cliente": "first_meal"}
var milestoneLevels = map[int]string{2: "level_2", 5: "level_5"}

type telemetryRecorder struct {
	app     core.App
	mu      sync.Mutex
	events  []telemetryEvent
	ledger  []ledgerEntry
	dropped atomic.Int64
	// Deleted accounts, ignored for a few minutes (forget in telemetry_routes.go).
	forgotten map[string]time.Time
	// Serializes writers: the flush loop, a manual flush and the shutdown flush.
	writing sync.Mutex
	stop    chan struct{}
	done    chan struct{}
}

func telemetryOf(app core.App) *telemetryRecorder {
	recorder, _ := app.Store().Get("telemetry").(*telemetryRecorder)
	return recorder
}

// trackEvent queues a server event. It never blocks and is a no-op when telemetry is off.
func trackEvent(app core.App, user, name, label string, props map[string]any) {
	if recorder := telemetryOf(app); recorder != nil {
		recorder.add(telemetryEvent{At: time.Now(), User: user, Source: "server", Name: name, Label: label, Props: props})
	}
}

func (t *telemetryRecorder) add(events ...telemetryEvent) {
	t.mu.Lock()
	defer t.mu.Unlock()
	for _, event := range events {
		if _, gone := t.forgotten[event.User]; gone && event.User != "" {
			continue
		}
		if len(t.events)+len(t.ledger) >= telemetryQueueLimit {
			t.dropped.Add(1)
			continue
		}
		t.events = append(t.events, event)
	}
}

func (t *telemetryRecorder) addLedger(entries ...ledgerEntry) {
	t.mu.Lock()
	defer t.mu.Unlock()
	for _, entry := range entries {
		if _, gone := t.forgotten[entry.User]; gone {
			continue
		}
		if len(t.events)+len(t.ledger) >= telemetryQueueLimit {
			t.dropped.Add(1)
			continue
		}
		t.ledger = append(t.ledger, entry)
	}
}

func ensureTelemetrySchema(app core.App) error {
	_, err := app.AuxNonconcurrentDB().NewQuery(`
CREATE TABLE IF NOT EXISTS telemetry_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	at INTEGER NOT NULL,
	day TEXT NOT NULL,
	user_id TEXT NOT NULL DEFAULT '',
	session TEXT NOT NULL DEFAULT '',
	source TEXT NOT NULL,
	name TEXT NOT NULL,
	label TEXT NOT NULL DEFAULT '',
	amount REAL,
	props TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_day ON telemetry_events (day, name);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_user ON telemetry_events (user_id, at);
CREATE TABLE IF NOT EXISTS telemetry_ledger (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	at INTEGER NOT NULL,
	day TEXT NOT NULL,
	user_id TEXT NOT NULL,
	currency TEXT NOT NULL,
	delta INTEGER NOT NULL,
	balance INTEGER NOT NULL,
	reason TEXT NOT NULL,
	ref TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_telemetry_ledger_day ON telemetry_ledger (day, reason);
CREATE INDEX IF NOT EXISTS idx_telemetry_ledger_user ON telemetry_ledger (user_id, at);
CREATE TABLE IF NOT EXISTS telemetry_activity (
	user_id TEXT NOT NULL,
	day TEXT NOT NULL,
	PRIMARY KEY (user_id, day)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_telemetry_activity_day ON telemetry_activity (day);
CREATE TABLE IF NOT EXISTS telemetry_milestones (
	user_id TEXT NOT NULL,
	name TEXT NOT NULL,
	at INTEGER NOT NULL,
	PRIMARY KEY (user_id, name)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS telemetry_daily (
	day TEXT NOT NULL,
	metric TEXT NOT NULL,
	label TEXT NOT NULL,
	count INTEGER NOT NULL,
	total REAL NOT NULL,
	p50 REAL,
	p95 REAL,
	peak REAL,
	PRIMARY KEY (day, metric, label)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS telemetry_rolled (day TEXT PRIMARY KEY) WITHOUT ROWID;
`).Execute()
	return err
}

// newTelemetryRecorder creates the tables and keeps the recorder in the app store, where
// trackEvent and the ledger hooks find it. The flush loop is started separately (start).
func newTelemetryRecorder(app core.App) (*telemetryRecorder, error) {
	if err := ensureTelemetrySchema(app); err != nil {
		return nil, err
	}
	recorder := &telemetryRecorder{app: app}
	app.Store().Set("telemetry", recorder)
	return recorder, nil
}

func (t *telemetryRecorder) start() {
	t.stop, t.done = make(chan struct{}), make(chan struct{})
	go func() {
		defer close(t.done)
		ticker := time.NewTicker(telemetryFlushEach)
		defer ticker.Stop()
		for {
			select {
			case <-t.stop:
				return
			case <-ticker.C:
				if err := t.flush(); err != nil {
					t.app.Logger().Warn("Não foi possível gravar a telemetria", "error", err)
				}
			}
		}
	}()
}

// close stops the loop and writes what is still queued.
func (t *telemetryRecorder) close() error {
	if t.stop != nil {
		close(t.stop)
		<-t.done
		t.stop = nil
	}
	return t.flush()
}

func (t *telemetryRecorder) flush() error {
	t.writing.Lock()
	defer t.writing.Unlock()
	t.mu.Lock()
	events, ledger := t.events, t.ledger
	t.events, t.ledger = nil, nil
	t.mu.Unlock()
	if len(events) == 0 && len(ledger) == 0 {
		return nil
	}
	err := t.app.AuxRunInTransaction(func(tx core.App) error {
		db := tx.AuxDB()
		activity := map[[2]string]bool{}
		milestones := map[[2]string]int64{}
		milestone := func(user, name string, at time.Time) {
			key := [2]string{user, name}
			if _, ok := milestones[key]; !ok && user != "" {
				milestones[key] = at.UnixMilli()
			}
		}
		for _, event := range events {
			props, err := json.Marshal(event.Props)
			if err != nil || event.Props == nil {
				props = []byte("{}")
			}
			var amount any
			if event.HasAmt {
				amount = event.Amount
			}
			day := telemetryDay(event.At)
			_, err = db.NewQuery("INSERT INTO telemetry_events (at, day, user_id, session, source, name, label, amount, props) VALUES ({:at}, {:day}, {:user}, {:session}, {:source}, {:name}, {:label}, {:amount}, {:props})").
				Bind(dbx.Params{"at": event.At.UnixMilli(), "day": day, "user": event.User, "session": event.Session, "source": event.Source, "name": event.Name, "label": event.Label, "amount": amount, "props": string(props)}).Execute()
			if err != nil {
				return err
			}
			if event.User != "" && (activeEvents[event.Name] || event.Source == "client") {
				activity[[2]string{event.User, day}] = true
			}
			if name := milestoneEvents[event.Name]; name != "" {
				milestone(event.User, name, event.At)
			}
			if event.Name == "level_up" {
				for level, name := range milestoneLevels {
					if int(event.Amount) >= level {
						milestone(event.User, name, event.At)
					}
				}
			}
		}
		for _, entry := range ledger {
			_, err := db.NewQuery("INSERT INTO telemetry_ledger (at, day, user_id, currency, delta, balance, reason, ref) VALUES ({:at}, {:day}, {:user}, {:currency}, {:delta}, {:balance}, {:reason}, {:ref})").
				Bind(dbx.Params{"at": entry.At.UnixMilli(), "day": telemetryDay(entry.At), "user": entry.User, "currency": entry.Currency, "delta": entry.Delta, "balance": entry.Balance, "reason": entry.Reason, "ref": entry.Ref}).Execute()
			if err != nil {
				return err
			}
			if name := milestoneLedger[entry.Reason]; name != "" {
				milestone(entry.User, name, entry.At)
			}
		}
		for key := range activity {
			if _, err := db.NewQuery("INSERT OR IGNORE INTO telemetry_activity (user_id, day) VALUES ({:user}, {:day})").Bind(dbx.Params{"user": key[0], "day": key[1]}).Execute(); err != nil {
				return err
			}
		}
		for key, at := range milestones {
			if _, err := db.NewQuery("INSERT OR IGNORE INTO telemetry_milestones (user_id, name, at) VALUES ({:user}, {:name}, {:at})").Bind(dbx.Params{"user": key[0], "name": key[1], "at": at}).Execute(); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		// Telemetry may lose a batch, never the game: count it and move on.
		t.dropped.Add(int64(len(events) + len(ledger)))
	}
	return err
}

// Ledger reasons travel on the record as data that is never persisted (keys outside the
// collection's fields): the code that changes a balance names the action right before saving.
const (
	ledgerReasonKey = "@ledger_reason"
	ledgerRefKey    = "@ledger_ref"
	ledgerBaseKey   = "@ledger_base"
	ledgerQueueKey  = "@ledger_queue"
)

// tagLedger names the action behind the next save of a player_state record.
func tagLedger(state *core.Record, reason, ref string) {
	state.Set(ledgerReasonKey, reason)
	state.Set(ledgerRefKey, ref)
}

type ledgerBalances struct {
	Cash, Gold, XP int64
	Level          int
}

func balancesOf(record *core.Record) ledgerBalances {
	return ledgerBalances{record.GetInt64("cash"), record.GetInt64("gold"), record.GetInt64("experience_current"), record.GetInt("level")}
}

// registerLedgerHooks records every change of caféGranas, caféOuros, XP and level, whoever
// made it: game routes, the room service, developer tools or the dashboard. Untagged changes
// keep the reason "outro", so a missing tag shows up instead of disappearing. Entries are
// queued only after the transaction commits.
func registerLedgerHooks(app core.App) {
	app.OnRecordUpdate(playerstate.Collection).BindFunc(func(e *core.RecordEvent) error {
		// A record saved twice in one transaction diffs against its previous save, not the row
		// it was read from; PocketBase keeps Original() at the read state until it is reloaded.
		before, ok := e.Record.GetRaw(ledgerBaseKey).(ledgerBalances)
		if !ok {
			before = balancesOf(e.Record.Original())
		}
		if err := e.Next(); err != nil {
			return err
		}
		after := balancesOf(e.Record)
		reason, ref := e.Record.GetString(ledgerReasonKey), e.Record.GetString(ledgerRefKey)
		if reason == "" {
			reason = "outro"
		}
		levelGold := e.Record.GetInt64(playerstate.LevelRewardGoldKey)
		now := time.Now()
		queue, _ := e.Record.GetRaw(ledgerQueueKey).([]ledgerEntry)
		entry := func(currency string, delta, balance int64, reason, ref string) {
			if delta != 0 {
				queue = append(queue, ledgerEntry{At: now, User: e.Record.GetString("user"), Currency: currency, Delta: delta, Balance: balance, Reason: reason, Ref: ref})
			}
		}
		entry("cash", after.Cash-before.Cash, after.Cash, reason, ref)
		// Level rewards are paid inside GrantExperience together with the action's own gold.
		if levelGold > 0 && after.Level > before.Level {
			entry("gold", levelGold, after.Gold, "nivel", strconv.Itoa(after.Level))
			entry("gold", after.Gold-before.Gold-levelGold, after.Gold, reason, ref)
		} else {
			entry("gold", after.Gold-before.Gold, after.Gold, reason, ref)
		}
		entry("xp", after.XP-before.XP, after.XP, reason, ref)
		for level := before.Level + 1; level <= after.Level; level++ {
			queue = append(queue, ledgerEntry{At: now, User: e.Record.GetString("user"), Currency: "level", Delta: 1, Balance: int64(level), Reason: reason, Ref: ref})
		}
		e.Record.Set(ledgerQueueKey, queue)
		e.Record.Set(ledgerBaseKey, after)
		e.Record.Set(ledgerReasonKey, "")
		e.Record.Set(ledgerRefKey, "")
		e.Record.Set(playerstate.LevelRewardGoldKey, 0)
		return nil
	})
	app.OnRecordAfterUpdateSuccess(playerstate.Collection).BindFunc(func(e *core.RecordEvent) error {
		queue, _ := e.Record.GetRaw(ledgerQueueKey).([]ledgerEntry)
		e.Record.Set(ledgerQueueKey, nil)
		if recorder := telemetryOf(e.App); recorder != nil && len(queue) > 0 {
			recorder.addLedger(queue...)
			for _, entry := range queue {
				if entry.Currency == "level" {
					recorder.add(telemetryEvent{At: entry.At, User: entry.User, Source: "server", Name: "level_up", Label: strconv.FormatInt(entry.Balance, 10), Amount: float64(entry.Balance), HasAmt: true})
				}
			}
		}
		return e.Next()
	})
	// A failed transaction must not leave its entries for a later save of the same record.
	app.OnRecordAfterUpdateError(playerstate.Collection).BindFunc(func(e *core.RecordErrorEvent) error {
		e.Record.Set(ledgerQueueKey, nil)
		e.Record.Set(ledgerBaseKey, nil)
		return e.Next()
	})
}
