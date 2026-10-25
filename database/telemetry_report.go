package main

import (
	"context"
	"sort"
	"strconv"
	"strings"
	"time"

	"coffe-mania/shared/juicecatalog"
	"coffe-mania/shared/recipecatalog"
	"coffe-mania/shared/roomcatalog"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Two connections of the same player less than this apart are one play session: visiting a
// friend's café or reloading the page opens a new connection.
const playSessionGap = 5 * time.Minute

// Event amounts summarized per day with percentiles (p50, p95 and the peak).
var telemetryAmounts = []string{"load", "fps", "online", "session_end"}

type dailyRow struct {
	Day    string   `db:"day" json:"-"`
	Metric string   `db:"metric" json:"-"`
	Label  string   `db:"label" json:"label"`
	Count  int64    `db:"count" json:"count"`
	Total  float64  `db:"total" json:"total"`
	P50    *float64 `db:"p50" json:"p50,omitempty"`
	P95    *float64 `db:"p95" json:"p95,omitempty"`
	Peak   *float64 `db:"peak" json:"peak,omitempty"`
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	index := int(p*float64(len(sorted))+0.999999) - 1
	return sorted[min(max(index, 0), len(sorted)-1)]
}

func summary(day, metric, label string, values []float64) dailyRow {
	sort.Float64s(values)
	total := 0.0
	for _, value := range values {
		total += value
	}
	p50, p95, peak := percentile(values, 0.5), percentile(values, 0.95), values[len(values)-1]
	return dailyRow{Day: day, Metric: metric, Label: label, Count: int64(len(values)), Total: total, P50: &p50, P95: &p95, Peak: &peak}
}

// rollupDay recomputes the aggregates of one day from the raw rows and replaces them. It is
// idempotent: today's numbers are refreshed on every dashboard load, past days by the daily
// routine before their raw rows expire.
func rollupDay(app core.App, day string) error {
	db := app.AuxDB()
	params := dbx.Params{"day": day}
	rows := []dailyRow{}
	var counts []struct {
		Name  string `db:"name"`
		Label string `db:"label"`
		Count int64  `db:"count"`
	}
	if err := db.NewQuery("SELECT name, label, COUNT(*) AS count FROM telemetry_events WHERE day = {:day} GROUP BY name, label").Bind(params).All(&counts); err != nil {
		return err
	}
	for _, row := range counts {
		rows = append(rows, dailyRow{Day: day, Metric: "event", Label: row.Name + "|" + row.Label, Count: row.Count})
	}
	var amounts []struct {
		Name   string  `db:"name"`
		Amount float64 `db:"amount"`
	}
	if err := db.NewQuery("SELECT name, amount FROM telemetry_events WHERE day = {:day} AND amount IS NOT NULL AND name IN ('load', 'fps', 'online', 'session_end')").Bind(params).All(&amounts); err != nil {
		return err
	}
	byName := map[string][]float64{}
	for _, row := range amounts {
		byName[row.Name] = append(byName[row.Name], row.Amount)
	}
	for _, name := range telemetryAmounts {
		if values := byName[name]; len(values) > 0 {
			rows = append(rows, summary(day, "amount", name, values))
		}
	}
	// Play sessions: each player's connections of the day, merged when close together.
	var connections []struct {
		User    string  `db:"user_id"`
		At      int64   `db:"at"`
		Seconds float64 `db:"amount"`
	}
	if err := db.NewQuery("SELECT user_id, at, amount FROM telemetry_events WHERE day = {:day} AND name = 'session_end' AND amount IS NOT NULL ORDER BY user_id, at").Bind(params).All(&connections); err != nil {
		return err
	}
	var sessions []float64
	type span struct{ start, end int64 }
	spans := map[string][]span{}
	for _, c := range connections {
		spans[c.User] = append(spans[c.User], span{c.At - int64(c.Seconds*1000), c.At})
	}
	for _, list := range spans {
		sort.Slice(list, func(i, j int) bool { return list[i].start < list[j].start })
		current := list[0]
		for _, next := range list[1:] {
			if next.start-current.end <= playSessionGap.Milliseconds() {
				current.end = max(current.end, next.end)
				continue
			}
			sessions = append(sessions, float64(current.end-current.start)/1000)
			current = next
		}
		sessions = append(sessions, float64(current.end-current.start)/1000)
	}
	if len(sessions) > 0 {
		rows = append(rows, summary(day, "play_session", "", sessions))
	}
	var ledger []struct {
		Currency string `db:"currency"`
		Reason   string `db:"reason"`
		In       int64  `db:"gained"`
		Out      int64  `db:"spent"`
		Gains    int64  `db:"gains"`
		Spends   int64  `db:"spends"`
	}
	if err := db.NewQuery(`SELECT currency, reason, SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS gained, SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS spent,
		SUM(CASE WHEN delta > 0 THEN 1 ELSE 0 END) AS gains, SUM(CASE WHEN delta < 0 THEN 1 ELSE 0 END) AS spends
		FROM telemetry_ledger WHERE day = {:day} AND currency != 'level' GROUP BY currency, reason`).Bind(params).All(&ledger); err != nil {
		return err
	}
	for _, row := range ledger {
		label := row.Currency + "|" + row.Reason
		if row.In > 0 {
			rows = append(rows, dailyRow{Day: day, Metric: "ledger_in", Label: label, Count: row.Gains, Total: float64(row.In)})
		}
		if row.Out > 0 {
			rows = append(rows, dailyRow{Day: day, Metric: "ledger_out", Label: label, Count: row.Spends, Total: float64(row.Out)})
		}
	}
	// Actions by what they were about (recipe, item, supply…). One save that moved two
	// currencies is still one action.
	var actions []struct {
		Reason string `db:"reason"`
		Ref    string `db:"ref"`
		Count  int64  `db:"count"`
	}
	if err := db.NewQuery("SELECT reason, ref, COUNT(DISTINCT user_id || ':' || at) AS count FROM telemetry_ledger WHERE day = {:day} AND currency IN ('cash', 'gold') GROUP BY reason, ref").Bind(params).All(&actions); err != nil {
		return err
	}
	for _, row := range actions {
		rows = append(rows, dailyRow{Day: day, Metric: "action", Label: row.Reason + "|" + row.Ref, Count: row.Count})
	}
	return app.AuxRunInTransaction(func(tx core.App) error {
		db := tx.AuxDB()
		if _, err := db.NewQuery("DELETE FROM telemetry_daily WHERE day = {:day}").Bind(params).Execute(); err != nil {
			return err
		}
		for _, row := range rows {
			_, err := db.NewQuery("INSERT INTO telemetry_daily (day, metric, label, count, total, p50, p95, peak) VALUES ({:day}, {:metric}, {:label}, {:count}, {:total}, {:p50}, {:p95}, {:peak})").
				Bind(dbx.Params{"day": row.Day, "metric": row.Metric, "label": row.Label, "count": row.Count, "total": row.Total, "p50": row.P50, "p95": row.P95, "peak": row.Peak}).Execute()
			if err != nil {
				return err
			}
		}
		return nil
	})
}

// maintainTelemetry rolls up every finished day not yet rolled up and then deletes the raw
// rows past the retention. Rolling up first means no day loses its aggregates.
func maintainTelemetry(app core.App, now time.Time) error {
	if recorder := telemetryOf(app); recorder != nil {
		if err := recorder.flush(); err != nil {
			return err
		}
	}
	today := telemetryDay(now)
	var days []string
	err := app.AuxDB().NewQuery(`SELECT day FROM (SELECT DISTINCT day FROM telemetry_events UNION SELECT DISTINCT day FROM telemetry_ledger)
		WHERE day < {:today} AND day NOT IN (SELECT day FROM telemetry_rolled) ORDER BY day`).Bind(dbx.Params{"today": today}).Column(&days)
	if err != nil {
		return err
	}
	for _, day := range days {
		if err = rollupDay(app, day); err != nil {
			return err
		}
		if _, err = app.AuxNonconcurrentDB().NewQuery("INSERT OR IGNORE INTO telemetry_rolled (day) VALUES ({:day})").Bind(dbx.Params{"day": day}).Execute(); err != nil {
			return err
		}
	}
	cutoff := dbx.Params{"before": now.Add(-telemetryRetention).UnixMilli()}
	return app.AuxRunInTransaction(func(tx core.App) error {
		for _, table := range []string{"telemetry_events", "telemetry_ledger"} {
			if _, err := tx.AuxDB().NewQuery("DELETE FROM " + table + " WHERE at < {:before}").Bind(cutoff).Execute(); err != nil {
				return err
			}
		}
		return nil
	})
}

type namedCount struct {
	Label string  `json:"label"`
	Name  string  `json:"name"`
	Count int64   `json:"count"`
	Total float64 `json:"total,omitempty"`
}

type daySeries struct {
	Day            string  `json:"day"`
	DAU            int     `json:"dau"`
	WAU            int     `json:"wau"`
	MAU            int     `json:"mau"`
	NewAccounts    int     `json:"newAccounts"`
	Sessions       int64   `json:"sessions"`
	SessionMinutes float64 `json:"sessionMinutes"`
	SessionP50     float64 `json:"sessionP50"`
	GoldIn         float64 `json:"goldIn"`
	GoldOut        float64 `json:"goldOut"`
	CashIn         float64 `json:"cashIn"`
	CashOut        float64 `json:"cashOut"`
	XP             float64 `json:"xp"`
	LoadP50        float64 `json:"loadP50"`
	LoadP95        float64 `json:"loadP95"`
	FpsP50         float64 `json:"fpsP50"`
	OnlinePeak     float64 `json:"onlinePeak"`
	Errors         int64   `json:"errors"`
	Disconnects    int64   `json:"disconnects"`
}

type retentionCell struct {
	Eligible int `json:"eligible"`
	Retained int `json:"retained"`
}

type retentionRow struct {
	Wave  string        `json:"wave"`
	Users int           `json:"users"`
	D1    retentionCell `json:"d1"`
	D7    retentionCell `json:"d7"`
	D30   retentionCell `json:"d30"`
}

type economyRow struct {
	Currency string  `json:"currency"`
	Reason   string  `json:"reason"`
	In       float64 `json:"in"`
	Out      float64 `json:"out"`
	Count    int64   `json:"count"`
}

type telemetryReport struct {
	GeneratedAt int64                   `json:"generatedAt"`
	Days        int                     `json:"days"`
	From        string                  `json:"from"`
	To          string                  `json:"to"`
	Staff       bool                    `json:"staff"`
	Now         liveGameMetrics         `json:"now"`
	OnlineToday []map[string]any        `json:"onlineToday"`
	Waitlist    map[string]int          `json:"waitlist"`
	Accounts    int                     `json:"accounts"`
	Series      []daySeries             `json:"series"`
	Retention   []retentionRow          `json:"retention"`
	Funnel      []namedCount            `json:"funnel"`
	Usage       map[string][]namedCount `json:"usage"`
	Economy     []economyRow            `json:"economy"`
	Health      map[string][]namedCount `json:"health"`
	Dropped     int64                   `json:"dropped"`
}

type reportAccount struct {
	ID      string `db:"id"`
	Created string `db:"created"`
	Wave    int    `db:"wave"`
	Role    string `db:"role"`
	Named   bool   `db:"cafe_name_chosen"`
	Level   int    `db:"level"`
}

func addDays(day string, n int) string {
	t, _ := time.ParseInLocation("2006-01-02", day, telemetryZone)
	return t.AddDate(0, 0, n).Format("2006-01-02")
}

// actionName turns a ledger reference into what the dashboard shows.
func actionName(reason, ref string) string {
	switch reason {
	case "cozinhar", "cliente":
		if recipe, ok := recipecatalog.ByID(ref); ok {
			return recipe.Name
		}
	case "loja", "venda":
		if id, err := strconv.Atoi(ref); err == nil {
			if item, ok := roomcatalog.ByID(id); ok {
				return item.Name
			}
		}
	case "suco":
		if recipe, ok := juicecatalog.ByID(ref); ok {
			return recipe.Name
		}
	case "encomenda", "encomenda_pressa", "encomenda_salvar":
		if kind, ok := supplyKindByID(ref); ok {
			return kind.Name
		}
	case "tempero":
		if chosen, ok := spiceByID(ref); ok {
			return chosen.Name
		}
	}
	return ref
}

func topCounts(counts map[string]*namedCount, limit int) []namedCount {
	out := make([]namedCount, 0, len(counts))
	for _, value := range counts {
		out = append(out, *value)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Label < out[j].Label
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

// buildTelemetryReport assembles the admin dashboard (/admin/metricas) for the last `days`
// days. Accounts of the admin role are left out of the player numbers (activity, retention,
// funnel) unless staff is set; event and economy aggregates include everyone, with developer
// tools visible as their own reason.
func buildTelemetryReport(ctx context.Context, app core.App, now time.Time, days int, staff bool) (telemetryReport, error) {
	report := telemetryReport{GeneratedAt: now.UnixMilli(), Days: days, Staff: staff, Usage: map[string][]namedCount{}, Health: map[string][]namedCount{}}
	recorder := telemetryOf(app)
	if recorder == nil {
		return report, nil
	}
	if err := recorder.flush(); err != nil {
		return report, err
	}
	report.Dropped = recorder.dropped.Load()
	today := telemetryDay(now)
	report.To, report.From = today, addDays(today, 1-days)
	for _, day := range []string{addDays(today, -1), today} {
		if err := rollupDay(app, day); err != nil {
			return report, err
		}
	}
	live, cancel := context.WithTimeout(ctx, 2*time.Second)
	report.Now, _ = gameMetrics(live, app)
	cancel()

	// Accounts, from the game database.
	var accounts []reportAccount
	err := app.DB().NewQuery(`SELECT u.id, u.created, COALESCE(u.wave, 0) AS wave, COALESCE(u.role, '') AS role,
		COALESCE(s.cafe_name_chosen, FALSE) AS cafe_name_chosen, COALESCE(s.level, 1) AS level
		FROM users u LEFT JOIN player_state s ON s.user = u.id`).All(&accounts)
	if err != nil {
		return report, err
	}
	counted := map[string]reportAccount{}
	for _, account := range accounts {
		if staff || account.Role != "admin" {
			counted[account.ID] = account
		}
	}
	report.Accounts = len(counted)
	report.Waitlist = map[string]int{"pending": 0, "confirmed": 0, "invited": 0, "joined": 0}
	var waitlist []struct {
		Status string `db:"status"`
		Count  int    `db:"count"`
	}
	if err = app.DB().NewQuery("SELECT status, COUNT(*) AS count FROM waitlist GROUP BY status").All(&waitlist); err != nil {
		return report, err
	}
	for _, row := range waitlist {
		report.Waitlist[row.Status] = row.Count
	}

	// Activity days since 29 days before the range (for MAU) and every signup cohort day.
	var activity []struct {
		User string `db:"user_id"`
		Day  string `db:"day"`
	}
	if err = app.AuxDB().NewQuery("SELECT user_id, day FROM telemetry_activity").All(&activity); err != nil {
		return report, err
	}
	activeOn := map[string]map[string]bool{}
	for _, row := range activity {
		if _, ok := counted[row.User]; !ok {
			continue
		}
		if activeOn[row.Day] == nil {
			activeOn[row.Day] = map[string]bool{}
		}
		activeOn[row.Day][row.User] = true
	}
	distinct := func(last string, span int) int {
		seen := map[string]bool{}
		for i := 0; i < span; i++ {
			for user := range activeOn[addDays(last, -i)] {
				seen[user] = true
			}
		}
		return len(seen)
	}
	signupDay := map[string]string{}
	newAccounts := map[string]int{}
	for id, account := range counted {
		created, err := time.Parse("2006-01-02 15:04:05.000Z", account.Created)
		if err != nil {
			continue
		}
		day := telemetryDay(created)
		signupDay[id] = day
		newAccounts[day]++
	}

	// Daily aggregates of the range.
	var daily []dailyRow
	if err = app.AuxDB().NewQuery("SELECT day, metric, label, count, total, p50, p95, peak FROM telemetry_daily WHERE day >= {:from} AND day <= {:to}").
		Bind(dbx.Params{"from": report.From, "to": report.To}).All(&daily); err != nil {
		return report, err
	}
	series := map[string]*daySeries{}
	for day := report.From; day <= report.To; day = addDays(day, 1) {
		series[day] = &daySeries{Day: day, DAU: len(activeOn[day]), WAU: distinct(day, 7), MAU: distinct(day, 30), NewAccounts: newAccounts[day]}
	}
	usage := map[string]map[string]*namedCount{}
	count := func(group, label, name string, n int64, total float64) {
		if usage[group] == nil {
			usage[group] = map[string]*namedCount{}
		}
		entry := usage[group][label]
		if entry == nil {
			entry = &namedCount{Label: label, Name: name}
			usage[group][label] = entry
		}
		entry.Count += n
		entry.Total += total
	}
	economy := map[[2]string]*economyRow{}
	for _, row := range daily {
		s := series[row.Day]
		if s == nil {
			continue
		}
		value := func(p *float64) float64 {
			if p == nil {
				return 0
			}
			return *p
		}
		switch row.Metric {
		case "event":
			name, label, _ := strings.Cut(row.Label, "|")
			switch name {
			case "screen":
				count("screens", label, label, row.Count, 0)
			case "js_error":
				s.Errors += row.Count
				count("errors", label, label, row.Count, 0)
			case "disconnect":
				s.Disconnects += row.Count
				count("disconnects", label, label, row.Count, 0)
			case "session_end":
				count("sessionEnds", label, label, row.Count, 0)
			}
			count("events", name, name, row.Count, 0)
		case "amount":
			switch row.Label {
			case "load":
				s.LoadP50, s.LoadP95 = value(row.P50), value(row.P95)
			case "fps":
				s.FpsP50 = value(row.P50)
			case "online":
				s.OnlinePeak = value(row.Peak)
			}
		case "play_session":
			s.Sessions, s.SessionMinutes, s.SessionP50 = row.Count, row.Total/60, value(row.P50)/60
		case "ledger_in", "ledger_out":
			currency, reason, _ := strings.Cut(row.Label, "|")
			key := [2]string{currency, reason}
			if economy[key] == nil {
				economy[key] = &economyRow{Currency: currency, Reason: reason}
			}
			economy[key].Count += row.Count
			if row.Metric == "ledger_in" {
				economy[key].In += row.Total
			} else {
				economy[key].Out += row.Total
			}
			switch {
			case currency == "gold" && row.Metric == "ledger_in":
				s.GoldIn += row.Total
			case currency == "gold":
				s.GoldOut += row.Total
			case currency == "cash" && row.Metric == "ledger_in":
				s.CashIn += row.Total
			case currency == "cash":
				s.CashOut += row.Total
			case currency == "xp" && row.Metric == "ledger_in":
				s.XP += row.Total
			}
		case "action":
			reason, ref, _ := strings.Cut(row.Label, "|")
			group := map[string]string{"cozinhar": "recipes", "loja": "items", "encomenda": "supplies", "suco": "juices", "tempero": "spices", "expansao": "expansions"}[reason]
			if group != "" {
				count(group, ref, actionName(reason, ref), row.Count, 0)
			}
		}
	}
	for day := report.From; day <= report.To; day = addDays(day, 1) {
		report.Series = append(report.Series, *series[day])
	}
	for group, counts := range usage {
		limit := 12
		if group == "errors" {
			limit = 15
		}
		target := report.Usage
		if group == "errors" || group == "disconnects" || group == "sessionEnds" {
			target = report.Health
		}
		target[group] = topCounts(counts, limit)
	}
	for _, row := range economy {
		report.Economy = append(report.Economy, *row)
	}
	sort.Slice(report.Economy, func(i, j int) bool {
		a, b := report.Economy[i], report.Economy[j]
		if a.Currency != b.Currency {
			return a.Currency < b.Currency
		}
		return a.In+a.Out > b.In+b.Out
	})

	// Retention by invite wave: of the accounts created N days ago or more, how many played on
	// the Nth day after signing up.
	cohorts := map[string]*retentionRow{"todas": {Wave: "todas"}}
	for id, account := range counted {
		signup, ok := signupDay[id]
		if !ok {
			continue
		}
		wave := strconv.Itoa(account.Wave)
		if cohorts[wave] == nil {
			cohorts[wave] = &retentionRow{Wave: wave}
		}
		for _, row := range []*retentionRow{cohorts["todas"], cohorts[wave]} {
			row.Users++
			for n, c := range map[int]*retentionCell{1: &row.D1, 7: &row.D7, 30: &row.D30} {
				target := addDays(signup, n)
				if target > today {
					continue
				}
				c.Eligible++
				if activeOn[target][id] {
					c.Retained++
				}
			}
		}
	}
	for _, row := range cohorts {
		report.Retention = append(report.Retention, *row)
	}
	sort.Slice(report.Retention, func(i, j int) bool {
		a, b := report.Retention[i].Wave, report.Retention[j].Wave
		if a == "todas" || b == "todas" {
			return a == "todas"
		}
		x, _ := strconv.Atoi(a)
		y, _ := strconv.Atoi(b)
		return x < y
	})

	// Funnel, since the alpha began (all time, not only the range).
	var milestones []struct {
		User string `db:"user_id"`
		Name string `db:"name"`
	}
	if err = app.AuxDB().NewQuery("SELECT user_id, name FROM telemetry_milestones").All(&milestones); err != nil {
		return report, err
	}
	reached := map[string]int{}
	for _, row := range milestones {
		if _, ok := counted[row.User]; ok {
			reached[row.Name]++
		}
	}
	var invited int
	if err = app.DB().NewQuery("SELECT COUNT(DISTINCT email) FROM invites").Row(&invited); err != nil {
		return report, err
	}
	named, level2, level5 := 0, 0, 0
	for _, account := range counted {
		if account.Named {
			named++
		}
		if account.Level >= 2 {
			level2++
		}
		if account.Level >= 5 {
			level5++
		}
	}
	report.Funnel = []namedCount{
		{Label: "invited", Name: "Convidados", Count: int64(invited)},
		{Label: "signup", Name: "Criaram a conta", Count: int64(len(counted))},
		{Label: "cafe_named", Name: "Deram nome ao café", Count: int64(named)},
		{Label: "first_cook", Name: "Cozinharam o primeiro prato", Count: int64(reached["first_cook"])},
		{Label: "first_meal", Name: "Serviram o primeiro cliente", Count: int64(reached["first_meal"])},
		{Label: "level_2", Name: "Chegaram ao nível 2", Count: int64(level2)},
		{Label: "level_5", Name: "Chegaram ao nível 5", Count: int64(level5)},
	}

	// Players online over the last 24 hours (samples every 5 minutes).
	var online []struct {
		At      int64   `db:"at"`
		Players float64 `db:"amount"`
		Props   string  `db:"props"`
	}
	if err = app.AuxDB().NewQuery("SELECT at, amount, props FROM telemetry_events WHERE name = 'online' AND at >= {:since} ORDER BY at").
		Bind(dbx.Params{"since": now.Add(-24 * time.Hour).UnixMilli()}).All(&online); err != nil {
		return report, err
	}
	report.OnlineToday = make([]map[string]any, 0, len(online))
	for _, row := range online {
		report.OnlineToday = append(report.OnlineToday, map[string]any{"at": row.At, "players": row.Players})
	}
	return report, nil
}
