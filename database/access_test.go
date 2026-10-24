package main

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"coffe-mania/shared/gamewire"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

const testBase = "http://localhost:5173"

func newAccessApp(t *testing.T) (core.App, string) {
	t.Helper()
	t.Setenv("COFFE_SMTP_HOST", "")
	t.Setenv("COFFE_ENV", "")
	return newCookingTestApp(t)
}

func mailCount(t *testing.T, app core.App) int {
	t.Helper()
	total, err := app.CountRecords("dev_mailbox")
	if err != nil {
		t.Fatal(err)
	}
	return int(total)
}

// lastSecret is the secret after "#" in the link of the newest kept message.
func lastSecret(t *testing.T, app core.App, kind string) string {
	t.Helper()
	records, err := app.FindRecordsByFilter("dev_mailbox", "kind = {:kind}", "-created,-id", 1, 0, dbx.Params{"kind": kind})
	if err != nil || len(records) == 0 {
		t.Fatalf("nenhum email %s", kind)
	}
	_, secret, ok := strings.Cut(records[0].GetString("link"), "#")
	if !ok || !strings.HasPrefix(records[0].GetString("link"), testBase) {
		t.Fatalf("link %q", records[0].GetString("link"))
	}
	return secret
}

func status(err error) int {
	var api *router.ApiError
	if errors.As(err, &api) {
		return api.Status
	}
	return 0
}

func waitlistEntry(email string) waitlistRequest {
	return waitlistRequest{Name: "Ana", Email: email, Adult: true, Privacy: true, LegalVersion: LegalVersion}
}

func TestWaitlistConfirmsOnceWithoutRevealingAccounts(t *testing.T) {
	app, _ := newAccessApp(t)
	now := time.Now()
	for _, bad := range []waitlistRequest{
		{Name: "Ana", Email: "nao-e-email", Adult: true, Privacy: true, LegalVersion: LegalVersion},
		{Name: "Ana", Email: "ana@example.com", Privacy: true, LegalVersion: LegalVersion},
		{Name: "Ana", Email: "ana@example.com", Adult: true, LegalVersion: LegalVersion},
	} {
		if status(joinWaitlist(app, bad, testBase, now)) != http.StatusBadRequest {
			t.Fatalf("aceitou %+v", bad)
		}
	}
	stale := waitlistEntry("ana@example.com")
	stale.LegalVersion = "2020-01-01"
	if status(joinWaitlist(app, stale, testBase, now)) != http.StatusConflict {
		t.Fatal("termos desatualizados pedem recarregar")
	}

	if err := joinWaitlist(app, waitlistEntry(" Ana@Example.com "), testBase, now); err != nil {
		t.Fatal(err)
	}
	first := lastSecret(t, app, "waitlist")
	if err := joinWaitlist(app, waitlistEntry("ana@example.com"), testBase, now.Add(time.Minute)); err != nil || mailCount(t, app) != 1 {
		t.Fatalf("repetir logo em seguida não manda outro email: %v, %d", err, mailCount(t, app))
	}
	// An existing account gets the same answer and no email.
	if err := joinWaitlist(app, waitlistEntry("chef@local.mail"), testBase, now); err != nil || mailCount(t, app) != 1 {
		t.Fatalf("email de conta existente: %v, %d", err, mailCount(t, app))
	}
	if err := joinWaitlist(app, waitlistEntry("bia@example.com"), testBase, now); err != nil {
		t.Fatal(err)
	}
	second := lastSecret(t, app, "waitlist")
	if position, err := confirmWaitlist(app, second, now.Add(time.Hour)); err != nil || position != 1 {
		t.Fatalf("primeira confirmação: %d %v", position, err)
	}
	if position, err := confirmWaitlist(app, first, now.Add(2*time.Hour)); err != nil || position != 2 {
		t.Fatalf("a fila segue a ordem de confirmação: %d %v", position, err)
	}
	if status(func() error { _, err := confirmWaitlist(app, first, now.Add(2*time.Hour)); return err }()) != http.StatusNotFound {
		t.Fatal("o link de confirmação vale uma vez")
	}
	if err := joinWaitlist(app, waitlistEntry("caio@example.com"), testBase, now); err != nil {
		t.Fatal(err)
	}
	if _, err := confirmWaitlist(app, lastSecret(t, app, "waitlist"), now.Add(4*24*time.Hour)); status(err) != http.StatusGone {
		t.Fatalf("link vencido: %v", err)
	}
}

func TestInviteCreatesVerifiedAccountOnce(t *testing.T) {
	app, _ := newAccessApp(t)
	now := time.Now()
	if err := joinWaitlist(app, waitlistEntry("ana@example.com"), testBase, now); err != nil {
		t.Fatal(err)
	}
	if _, err := confirmWaitlist(app, lastSecret(t, app, "waitlist"), now); err != nil {
		t.Fatal(err)
	}
	invited, err := inviteWaitlist(app, 15, 1, defaultInviteTTL, "", testBase, now)
	if err != nil || len(invited) != 1 || invited[0] != "ana@example.com" {
		t.Fatalf("onda 1: %v %v", invited, err)
	}
	code := lastSecret(t, app, "invite")
	request := signupRequest{Code: code, Name: "Ana Paula", Password: "cafe-da-ana-2026", PasswordConfirm: "cafe-da-ana-2026", Adult: true, Terms: true, LegalVersion: LegalVersion}

	weak := request
	weak.Password, weak.PasswordConfirm = "12345678", "12345678"
	if status(func() error { _, err := signup(app, weak, now); return err }()) != http.StatusBadRequest {
		t.Fatal("senha comum recusada")
	}
	minor := request
	minor.Adult = false
	if _, err := signup(app, minor, now); status(err) != http.StatusBadRequest {
		t.Fatal("menor de idade recusado")
	}
	if _, err := signup(app, request, now.Add(15*24*time.Hour)); status(err) != http.StatusGone {
		t.Fatal("convite vencido")
	}

	user, err := signup(app, request, now)
	if err != nil {
		t.Fatal(err)
	}
	if !user.Verified() || user.Email() != "ana@example.com" || accountRole(user) != "player" || user.GetString("terms_version") != LegalVersion ||
		user.GetDateTime("adult_confirmed_at").IsZero() || user.GetInt("wave") != 1 || !user.ValidatePassword(request.Password) {
		t.Fatalf("conta criada: %+v", user.PublicExport())
	}
	if _, err = signup(app, request, now); status(err) != http.StatusGone {
		t.Fatalf("o convite vale uma vez: %v", err)
	}
	entry, _ := app.FindFirstRecordByData("waitlist", "email", "ana@example.com")
	if entry.GetString("status") != "joined" {
		t.Fatalf("lista de espera: %s", entry.GetString("status"))
	}

	// A new invite for the same email turns the previous unused one off.
	old, _, _ := issueInvite(app, "bia@example.com", 1, "admin", "", defaultInviteTTL, now)
	latest, _, _ := issueInvite(app, "bia@example.com", 1, "admin", "", defaultInviteTTL, now.Add(time.Second))
	if _, err = findInvite(app, old, now.Add(2*time.Second)); err == nil {
		t.Fatal("o convite antigo deixa de valer")
	}
	if _, err = findInvite(app, latest, now.Add(2*time.Second)); err != nil {
		t.Fatal(err)
	}
}

func TestPlayerNameAndPasswordRules(t *testing.T) {
	for name, ok := range map[string]bool{
		"Ana": true, "  João   da Silva ": true, "chef_23": true, "Zé.Café-2": true,
		"ab": false, "<script>": false, "Admin do Jogo": false, "Equipe Vostu": false, "M3rda": false, "caralhada": false,
		"Computador": true, "Disputa": true, "Ana Puta": false,
	} {
		if _, err := cleanPlayerName(name); (err == nil) != ok {
			t.Fatalf("nome %q: aceito=%v", name, err == nil)
		}
	}
	if cleaned, _ := cleanPlayerName("  João   da Silva "); cleaned != "João da Silva" {
		t.Fatalf("espaços: %q", cleaned)
	}
	for password, ok := range map[string]bool{
		"curto1": false, "senha123": false, "aaaaaaaaaa": false, "anapaula-99": false, "boa-senha-do-cafe": true,
	} {
		if err := checkPassword(password, password, "anapaula@example.com"); (err == nil) != ok {
			t.Fatalf("senha %q: aceita=%v", password, err == nil)
		}
	}
	if checkPassword("boa-senha-do-cafe", "outra", "a@b.co") == nil {
		t.Fatal("confirmação diferente")
	}
}

func TestPasswordResetWorksOnceAndEndsSessions(t *testing.T) {
	app, userID := newAccessApp(t)
	registerAccountHooks(app)
	user := testUser(t, app, userID)
	session, _ := user.NewAuthToken()
	now := time.Now()
	if err := requestPasswordReset(app, "ninguem@example.com", testBase, now); err != nil || mailCount(t, app) != 0 {
		t.Fatal("email desconhecido: mesma resposta, nenhum envio")
	}
	if err := requestPasswordReset(app, "CHEF@local.mail", testBase, now); err != nil {
		t.Fatal(err)
	}
	if err := requestPasswordReset(app, "chef@local.mail", testBase, now.Add(time.Minute)); err != nil || mailCount(t, app) != 1 {
		t.Fatal("um pedido por vez")
	}
	token := lastSecret(t, app, "password")
	if err := resetPassword(app, token, "nova-senha-do-cafe", "nova-senha-do-cafe"); err != nil {
		t.Fatal(err)
	}
	if !testUser(t, app, userID).ValidatePassword("nova-senha-do-cafe") {
		t.Fatal("senha nova")
	}
	if _, err := app.FindAuthRecordByToken(session, core.TokenTypeAuth); err == nil {
		t.Fatal("trocar a senha encerra as sessões antigas")
	}
	if status(resetPassword(app, token, "outra-senha-boa", "outra-senha-boa")) != http.StatusGone {
		t.Fatal("o link de nova senha vale uma vez")
	}
}

func TestDeleteAccountRemovesCafeAndWaitlist(t *testing.T) {
	app, userID := newAccessApp(t)
	user := testUser(t, app, userID)
	if err := joinWaitlist(app, waitlistEntry("outra@example.com"), testBase, time.Now()); err != nil {
		t.Fatal(err)
	}
	collection, _ := app.FindCollectionByNameOrId("waitlist")
	entry := core.NewRecord(collection)
	entry.Set("email", user.Email())
	entry.Set("name", "Chef")
	entry.Set("status", "joined")
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	export, err := exportAccount(app, user)
	if err != nil {
		t.Fatal(err)
	}
	data := export["data"].(map[string]any)
	if len(data) < 2 || data["waitlist"] == nil {
		t.Fatalf("exportação: %v", export)
	}
	relations, _ := userRelations(app)
	if err = deleteAccount(app, user); err != nil {
		t.Fatal(err)
	}
	if _, err = app.FindRecordById("users", userID); err == nil {
		t.Fatal("conta excluída")
	}
	for collection, fields := range relations {
		for _, field := range fields {
			if rows, _ := app.FindRecordsByFilter(collection, field+" ?= {:id}", "", 1, 0, dbx.Params{"id": userID}); len(rows) > 0 {
				t.Fatalf("%s.%s ficou com dados da conta", collection, field)
			}
		}
	}
	// The room service may still hold the café in memory; its final save must not fail.
	if err = saveDormantRoom(app, userID, gamewire.Sleep{}); err != nil {
		t.Fatalf("salvar o quarto de uma conta excluída: %v", err)
	}
	if _, err = app.FindFirstRecordByData("waitlist", "email", "chef@local.mail"); err == nil {
		t.Fatal("a entrada da lista de espera sai junto")
	}
	if _, err = app.FindFirstRecordByData("waitlist", "email", "outra@example.com"); err != nil {
		t.Fatal("outras pessoas continuam na lista")
	}
}

// The client shows the legal texts and the server records the accepted version: both must
// name the same one.
func TestLegalVersionMatchesClientTexts(t *testing.T) {
	source, err := os.ReadFile("../game/src/auth/legal.ts")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(source), "export const LEGAL_VERSION = '"+LegalVersion+"';") {
		t.Fatalf("game/src/auth/legal.ts não usa a versão %s", LegalVersion)
	}
}
