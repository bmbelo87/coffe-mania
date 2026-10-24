package main

import (
	"strings"
	"testing"
	"time"

	"coffe-mania/shared/gamewire"
	"github.com/pocketbase/pocketbase/core"
)

func testUser(t *testing.T, app core.App, id string) *core.Record {
	t.Helper()
	record, err := app.FindRecordById("users", id)
	if err != nil {
		t.Fatal(err)
	}
	return record
}

func TestSuspensionInvalidatesExistingSessions(t *testing.T) {
	app, userID := newCookingTestApp(t)
	registerAccountHooks(app)
	user := testUser(t, app, userID)
	token, err := user.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	user.Set("name", "Chef")
	if err = app.Save(user); err != nil {
		t.Fatal(err)
	}
	if _, err = app.FindAuthRecordByToken(token, core.TokenTypeAuth); err != nil {
		t.Fatal("editar o nome não encerra a sessão")
	}
	until := time.Now().Add(48 * time.Hour)
	user.Set("suspended_until", until)
	user.Set("suspension_reason", "Uso de programa externo.")
	if err = app.Save(user); err != nil {
		t.Fatal(err)
	}
	if _, err = app.FindAuthRecordByToken(token, core.TokenTypeAuth); err == nil {
		t.Fatal("a suspensão precisa invalidar o cookie emitido antes dela")
	}
	user = testUser(t, app, userID)
	if got, ok := suspendedUntil(user, time.Now()); !ok || got.Unix() != until.Unix() {
		t.Fatalf("suspensa até %v (%v)", got, ok)
	}
	if message := suspensionMessage(user, until); !strings.Contains(message, "horário de Brasília") || !strings.Contains(message, "Uso de programa externo.") {
		t.Fatalf("mensagem %q", message)
	}
	if _, ok := suspendedUntil(user, until.Add(time.Second)); ok {
		t.Fatal("a suspensão termina sozinha no prazo")
	}
	user.Set("suspended_until", time.Date(9999, 1, 1, 0, 0, 0, 0, time.UTC))
	if message := suspensionMessage(user, time.Date(9999, 1, 1, 0, 0, 0, 0, time.UTC)); !strings.Contains(message, "tempo indeterminado") {
		t.Fatalf("banimento sem prazo: %q", message)
	}
}

func TestDevToolsNeedServerFlagAndStaffRole(t *testing.T) {
	app, userID := newCookingTestApp(t)
	user := testUser(t, app, userID)
	t.Setenv("COFFE_DEV_TOOLS", "true")
	if devToolsFor(user) || accountRole(user) != "player" {
		t.Fatal("conta comum não recebe ferramentas de desenvolvimento")
	}
	for _, role := range []string{"tester", "admin"} {
		user.Set("role", role)
		if !devToolsFor(user) || !isStaff(user) {
			t.Fatalf("%s deveria ter as ferramentas", role)
		}
	}
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}
	if !devToolsForUser(app, userID) {
		t.Fatal("a operação do quarto confere o papel salvo")
	}
	t.Setenv("COFFE_DEV_TOOLS", "false")
	if devToolsFor(user) {
		t.Fatal("sem a flag do servidor ninguém recebe as ferramentas")
	}
}

func TestMaintenanceIsScheduledAndReopened(t *testing.T) {
	app, _ := newCookingTestApp(t)
	now := time.Now()
	if status := currentStatus(app); status.Mode != gamewire.ModeOpen || status.Active(now.UnixMilli()) {
		t.Fatalf("banco novo começa aberto: %+v", status)
	}
	starts := now.Add(10 * time.Minute).UnixMilli()
	status, err := saveStatus(app, statusCommand{Mode: "maintenance", StartsAt: starts, EndsAt: starts + 3600000}, now)
	if err != nil {
		t.Fatal(err)
	}
	if status.Active(now.UnixMilli()) || !status.Active(starts) || status.Message != defaultMaintenanceMessage || status.EndsAt != starts+3600000 {
		t.Fatalf("manutenção programada: %+v", status)
	}
	if status, err = saveStatus(app, statusCommand{Mode: "closed", Message: "  Até a próxima!  "}, now); err != nil || !status.Active(now.UnixMilli()) || status.Message != "Até a próxima!" {
		t.Fatalf("encerrado: %+v %v", status, err)
	}
	if status, err = saveStatus(app, statusCommand{Mode: "open", StartsAt: starts}, now); err != nil || status.Active(now.UnixMilli()) || status.StartsAt != 0 {
		t.Fatalf("reaberto sem horários antigos: %+v %v", status, err)
	}
	for _, bad := range []statusCommand{
		{Mode: "paused"},
		{Mode: "maintenance", StartsAt: now.Add(8 * 24 * time.Hour).UnixMilli()},
		{Mode: "maintenance", StartsAt: starts, EndsAt: starts - 1},
		{Mode: "maintenance", Message: strings.Repeat("a", 501)},
	} {
		if _, err := saveStatus(app, bad, now); err == nil {
			t.Fatalf("aceitou %+v", bad)
		}
	}
}

func TestMaintenanceLocksGameRoutesOnly(t *testing.T) {
	for path, locked := range map[string]bool{
		"/play": true, "/play/": true, "/api/realtime": true, "/api/coffe/cooking": true, "/api/coffe/game-ticket": true,
		"/": false, "/assets/app.js": false, "/api/coffe/session": false, "/api/coffe/session/login": false,
		"/api/coffe/status": false, "/api/coffe/admin/status": false, "/api/coffe/game-internal/owner/load": false,
		"/api/coffe/sessionx": true, "/api/coffe/statuses": true,
	} {
		if lockedPath(path) != locked {
			t.Fatalf("%s: bloqueado=%v", path, !locked)
		}
	}
}

func TestProductionRefusesUnsafeConfiguration(t *testing.T) {
	t.Setenv("COFFE_ENV", "production")
	t.Setenv("COFFE_DEV_TOOLS", "true")
	t.Setenv("COFFE_DEV_SEED", "true")
	t.Setenv("COFFE_SECURE_COOKIES", "false")
	t.Setenv("COFFE_TRUSTED_PROXY_HEADER", "")
	err := checkProductionConfig()
	if err == nil || !strings.Contains(err.Error(), "COFFE_DEV_TOOLS") || !strings.Contains(err.Error(), "COFFE_SECURE_COOKIES") {
		t.Fatalf("erro %v", err)
	}
	t.Setenv("COFFE_DEV_TOOLS", "false")
	t.Setenv("COFFE_DEV_SEED", "false")
	t.Setenv("COFFE_SECURE_COOKIES", "true")
	t.Setenv("COFFE_TRUSTED_PROXY_HEADER", "X-Real-IP")
	if err = checkProductionConfig(); err == nil || !strings.Contains(err.Error(), "COFFE_SMTP_HOST") {
		t.Fatalf("sem email e Turnstile: %v", err)
	}
	for name, value := range map[string]string{
		"COFFE_PUBLIC_URL": "https://jogo.example.com", "COFFE_SMTP_HOST": "smtp.example.com", "COFFE_MAIL_FROM": "jogo@example.com",
		"COFFE_CONTACT_EMAIL": "contato@example.com", "COFFE_TURNSTILE_SITE_KEY": "site", "COFFE_TURNSTILE_SECRET": "secret",
	} {
		t.Setenv(name, value)
	}
	if err = checkProductionConfig(); err != nil {
		t.Fatal(err)
	}
	t.Setenv("COFFE_ENV", "")
	t.Setenv("COFFE_DEV_TOOLS", "true")
	if err = checkProductionConfig(); err != nil {
		t.Fatal("o modo dev não é bloqueado")
	}
}
