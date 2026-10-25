package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"net/http"
	"net/mail"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"
)

// LegalVersion identifies the Terms, Privacy and Conduct texts (game/src/auth/legal.ts).
// Signup and the waitlist record the version accepted; a stale page must reload.
const LegalVersion = "2026-10-25"

const (
	minimumAge          = 18
	waitlistLinkTTL     = 72 * time.Hour
	waitlistResendAfter = 10 * time.Minute
	resetResendAfter    = 5 * time.Minute
	defaultInviteTTL    = 14 * 24 * time.Hour
)

var errMailUnavailable = errors.New("o envio de email não está configurado")

// publicBase is the address used in email links. Production always uses the configured
// address: links built from the Host header could be pointed at another site.
func publicBase(r *core.RequestEvent) string {
	if base := strings.TrimRight(os.Getenv("COFFE_PUBLIC_URL"), "/"); base != "" {
		return base
	}
	if isProduction() {
		return ""
	}
	scheme := "http"
	if requestUsesHTTPS(r.Request) {
		scheme = "https"
	}
	return scheme + "://" + r.Request.Host
}

// newSecret returns 160 random bits as lowercase base32 (32 characters, safe in URLs).
func newSecret() string {
	buffer := make([]byte, 20)
	if _, err := rand.Read(buffer); err != nil {
		panic(err)
	}
	return strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(buffer))
}

func secretHash(secret string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(secret)))
	return hex.EncodeToString(sum[:])
}

func normalizeEmail(value string) (string, bool) {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" || len(value) > 254 {
		return "", false
	}
	address, err := mail.ParseAddress(value)
	at := strings.LastIndex(value, "@")
	if err != nil || address.Address != value || at < 1 || !strings.Contains(value[at+1:], ".") {
		return "", false
	}
	return value, true
}

var nameShape = regexp.MustCompile(`^[\p{L}\p{N}][\p{L}\p{N} ._-]*[\p{L}\p{N}]$`)

var nameFold = strings.NewReplacer(
	"á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a", "é", "e", "ê", "e", "è", "e", "í", "i", "ì", "i", "î", "i",
	"ó", "o", "ô", "o", "õ", "o", "ò", "o", "ö", "o", "ú", "u", "ù", "u", "ü", "u", "ç", "c",
	"0", "o", "1", "i", "3", "e", "4", "a", "5", "s", "7", "t", "@", "a",
)

// Whole words, prefixes of a word and names reserved to avoid impersonating the team.
var (
	blockedWords    = map[string]bool{"puta": true, "puto": true, "merda": true, "porra": true, "foda": true, "fdp": true, "pqp": true, "vsf": true, "viado": true, "bosta": true, "cu": true, "cuzao": true, "otario": true, "corno": true, "vadia": true, "nazi": true, "hitler": true}
	blockedPrefixes = []string{"caralh", "bucet", "bocet", "fuder", "foder", "arromb", "xoxot", "pirok", "punhet", "rapariga", "vagabund"}
	reservedNames   = []string{"admin", "moderador", "suporte", "vostu", "cafemania", "staff", "equipe"}
)

// cleanPlayerName collapses spaces and refuses names that are offensive or impersonate the
// team. It is a first barrier for the alpha; reports and moderation come later.
func cleanPlayerName(value string) (string, error) {
	value = strings.Join(strings.Fields(value), " ")
	if count := utf8.RuneCountInString(value); count < 3 || count > 24 || !nameShape.MatchString(value) {
		return "", apis.NewBadRequestError("Use de 3 a 24 letras ou números no nome (espaço, ponto, hífen e sublinhado também valem).", nil)
	}
	folded := nameFold.Replace(strings.ToLower(value))
	words := strings.FieldsFunc(folded, func(r rune) bool { return r < 'a' || r > 'z' })
	joined := strings.Join(words, "")
	for _, word := range words {
		if blockedWords[word] {
			return "", apis.NewBadRequestError("Escolha outro nome.", nil)
		}
		for _, prefix := range blockedPrefixes {
			if strings.HasPrefix(word, prefix) {
				return "", apis.NewBadRequestError("Escolha outro nome.", nil)
			}
		}
	}
	for _, reserved := range reservedNames {
		if strings.Contains(joined, reserved) {
			return "", apis.NewBadRequestError("Esse nome é reservado. Escolha outro.", nil)
		}
	}
	return value, nil
}

var commonPasswords = map[string]bool{
	"12345678": true, "123456789": true, "1234567890": true, "87654321": true, "11111111": true, "00000000": true, "88888888": true,
	"12341234": true, "12121212": true, "abcd1234": true, "abc12345": true, "1q2w3e4r": true, "q1w2e3r4": true, "qwerty123": true,
	"qwertyui": true, "asdfghjk": true, "password": true, "password1": true, "password123": true, "iloveyou": true, "senha123": true,
	"senha1234": true, "senha12345": true, "senhasenha": true, "minhasenha": true, "mudar123": true, "123mudar": true, "admin123": true,
	"teste123": true, "brasil123": true, "flamengo": true, "flamengo1": true, "corinthians": true, "palmeiras": true, "cafemania": true,
	"cafemania1": true, "cafe1234": true, "aaaaaaaa": true, "naosei123": true, "princesa": true, "estrela1": true,
}

func checkPassword(password, confirm, email string) error {
	if password != confirm {
		return apis.NewBadRequestError("As senhas não conferem.", nil)
	}
	if utf8.RuneCountInString(password) < 8 {
		return apis.NewBadRequestError("Use pelo menos 8 caracteres na senha.", nil)
	}
	if len(password) > 72 {
		return apis.NewBadRequestError("Use no máximo 72 caracteres na senha.", nil)
	}
	lower := strings.ToLower(password)
	if commonPasswords[lower] || strings.Count(lower, lower[:1]) == len(lower) {
		return apis.NewBadRequestError("Essa senha é muito comum. Escolha outra.", nil)
	}
	if local, _, _ := strings.Cut(email, "@"); len(local) >= 4 && strings.Contains(lower, local) {
		return apis.NewBadRequestError("A senha não pode conter o seu email.", nil)
	}
	return nil
}

func dateTime(t time.Time) types.DateTime {
	value, _ := types.ParseDateTime(t.UTC())
	return value
}

func expired(record *core.Record, field string, ttl time.Duration, now time.Time) bool {
	value := record.GetDateTime(field)
	return value.IsZero() || now.Sub(value.Time()) > ttl
}

type waitlistRequest struct {
	Name         string `json:"name"`
	Email        string `json:"email"`
	Memory       string `json:"memory"`
	Adult        bool   `json:"adult"`
	Privacy      bool   `json:"privacy"`
	LegalVersion string `json:"legalVersion"`
	Turnstile    string `json:"turnstile"`
	// Website is a field hidden from people; bots that fill every input reveal themselves.
	Website string `json:"website"`
}

func staleLegal() error {
	return apis.NewApiError(http.StatusConflict, "Os termos foram atualizados. Recarregue a página para ler a versão nova.", nil)
}

// joinWaitlist answers the same way whether or not the email is known: the page always
// says "check your inbox", so the form cannot be used to discover who signed up.
func joinWaitlist(app core.App, request waitlistRequest, base string, now time.Time) error {
	name := strings.Join(strings.Fields(request.Name), " ")
	email, ok := normalizeEmail(request.Email)
	memory := strings.TrimSpace(request.Memory)
	switch {
	case name == "" || utf8.RuneCountInString(name) > 60:
		return apis.NewBadRequestError("Informe seu nome (até 60 caracteres).", nil)
	case !ok:
		return apis.NewBadRequestError("Informe um email válido.", nil)
	case utf8.RuneCountInString(memory) > 500:
		return apis.NewBadRequestError("Conte sua lembrança em até 500 caracteres.", nil)
	case !request.Adult:
		return apis.NewBadRequestError("O alpha é só para maiores de 18 anos.", nil)
	case !request.Privacy:
		return apis.NewBadRequestError("Aceite a Política de Privacidade para entrar na lista.", nil)
	case request.LegalVersion != LegalVersion:
		return staleLegal()
	}
	if _, err := app.FindAuthRecordByEmail("users", email); err == nil {
		return nil
	}
	entry, err := app.FindFirstRecordByData("waitlist", "email", email)
	created := false
	switch {
	case errors.Is(err, sql.ErrNoRows):
		collection, err := app.FindCollectionByNameOrId("waitlist")
		if err != nil {
			return err
		}
		entry, created = core.NewRecord(collection), true
		entry.Set("email", email)
		entry.Set("status", "pending")
	case err != nil:
		return err
	case entry.GetString("status") != "pending" || !expired(entry, "confirm_sent_at", waitlistResendAfter, now):
		return nil
	}
	token := newSecret()
	entry.Set("name", name)
	entry.Set("memory", memory)
	entry.Set("privacy_version", LegalVersion)
	entry.Set("confirm_hash", secretHash(token))
	entry.Set("confirm_sent_at", dateTime(now))
	if err = app.Save(entry); err != nil {
		return err
	}
	err = sendGameMail(app, gameMail{
		To: email, Kind: "waitlist", Subject: "Confirme sua vaga no alpha do Café Mania", Title: "Confirme sua vaga",
		Paragraphs: []string{
			"Olá, " + name + "! Recebemos seu pedido para entrar na lista de espera do alpha fechado do Café Mania.",
			"Confirme seu email para garantir a vaga. O link vale por 3 dias. Os convites saem em ondas, por ordem de confirmação.",
		},
		Button: "Confirmar minha vaga", Link: base + "/lista/confirmar#" + token,
	}, base)
	if err != nil {
		app.Logger().Error("Falha ao enviar a confirmação da lista de espera", "error", err)
		if created {
			_ = app.Delete(entry)
		}
		return apis.NewApiError(http.StatusServiceUnavailable, "Não foi possível enviar o email agora. Tente de novo em alguns minutos.", nil)
	}
	if created {
		trackEvent(app, "", "waitlist_join", "", nil)
	}
	return nil
}

// confirmWaitlist validates the emailed link and returns the place in the queue.
func confirmWaitlist(app core.App, token string, now time.Time) (int, error) {
	entry, err := app.FindFirstRecordByFilter("waitlist", "confirm_hash = {:hash} && status = 'pending'", dbx.Params{"hash": secretHash(token)})
	if err != nil || token == "" {
		return 0, apis.NewNotFoundError("Este link é inválido ou já foi usado.", nil)
	}
	if expired(entry, "confirm_sent_at", waitlistLinkTTL, now) {
		return 0, apis.NewApiError(http.StatusGone, "Este link venceu. Entre na lista de novo para receber outro.", nil)
	}
	entry.Set("status", "confirmed")
	entry.Set("confirmed_at", dateTime(now))
	entry.Set("confirm_hash", "")
	if err = app.Save(entry); err != nil {
		return 0, err
	}
	trackEvent(app, "", "waitlist_confirm", "", nil)
	var position int
	err = app.DB().NewQuery("SELECT COUNT(*) FROM waitlist WHERE status = 'confirmed' AND confirmed_at <= {:at}").
		Bind(dbx.Params{"at": entry.GetDateTime("confirmed_at").String()}).Row(&position)
	return position, err
}

// issueInvite creates a single-use code bound to one email. Older unused codes of that email
// stop working, so only the latest email is valid.
func issueInvite(app core.App, email string, wave int, source, createdBy string, ttl time.Duration, now time.Time) (string, *core.Record, error) {
	collection, err := app.FindCollectionByNameOrId("invites")
	if err != nil {
		return "", nil, err
	}
	code := newSecret()
	invite := core.NewRecord(collection)
	err = app.RunInTransaction(func(tx core.App) error {
		old, err := tx.FindRecordsByFilter("invites", "email = {:email} && used_at = '' && expires_at > {:now}", "", 0, 0, dbx.Params{"email": email, "now": dateTime(now).String()})
		if err != nil {
			return err
		}
		for _, record := range old {
			record.Set("expires_at", dateTime(now))
			if err = tx.Save(record); err != nil {
				return err
			}
		}
		invite.Set("code_hash", secretHash(code))
		invite.Set("email", email)
		invite.Set("wave", wave)
		invite.Set("source", source)
		invite.Set("expires_at", dateTime(now.Add(ttl)))
		if createdBy != "" {
			invite.Set("created_by", createdBy)
		}
		return tx.Save(invite)
	})
	if err == nil {
		trackEvent(app, "", "invite_sent", source, map[string]any{"wave": wave})
	}
	return code, invite, err
}

func inviteMail(email, code, base string, expires time.Time) gameMail {
	return gameMail{
		To: email, Kind: "invite", Subject: "Seu convite para o alpha do Café Mania chegou!", Title: "Seu convite chegou!",
		Paragraphs: []string{
			"Você foi convidado para o alpha fechado do Café Mania, o projeto de fãs que traz de volta o café da época do Orkut.",
			"O convite é pessoal: vale para " + email + " e expira em " + expires.In(brasilia).Format("02/01/2006") + ".",
			"No alpha o progresso será apagado quando o beta chegar, mas quem joga agora fica com o selo de Fundador.",
		},
		Button: "Criar minha conta", Link: base + "/convite#" + code,
	}
}

// findInvite returns a usable invite for a code, or the same error for every failure.
func findInvite(app core.App, code string, now time.Time) (*core.Record, error) {
	invalid := apis.NewApiError(http.StatusGone, "Este convite é inválido, já foi usado ou venceu.", nil)
	if code == "" || len(code) > 64 {
		return nil, invalid
	}
	invite, err := app.FindFirstRecordByData("invites", "code_hash", secretHash(code))
	if err != nil || !invite.GetDateTime("used_at").IsZero() || !invite.GetDateTime("expires_at").Time().After(now) {
		return nil, invalid
	}
	return invite, nil
}

type signupRequest struct {
	Code            string `json:"code"`
	Name            string `json:"name"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"passwordConfirm"`
	Adult           bool   `json:"adult"`
	Terms           bool   `json:"terms"`
	LegalVersion    string `json:"legalVersion"`
}

// signup is the only way to create a player account: it spends a valid invite and the
// account is born verified, since the invite reached that email.
func signup(app core.App, request signupRequest, now time.Time) (*core.Record, error) {
	switch {
	case !request.Adult:
		return nil, apis.NewBadRequestError("O alpha é só para maiores de 18 anos.", nil)
	case !request.Terms:
		return nil, apis.NewBadRequestError("Aceite os Termos de Uso, a Política de Privacidade e o Código de Conduta.", nil)
	case request.LegalVersion != LegalVersion:
		return nil, staleLegal()
	}
	name, err := cleanPlayerName(request.Name)
	if err != nil {
		return nil, err
	}
	invite, err := findInvite(app, request.Code, now)
	if err != nil {
		return nil, err
	}
	email := invite.GetString("email")
	if err = checkPassword(request.Password, request.PasswordConfirm, email); err != nil {
		return nil, err
	}
	var user *core.Record
	err = app.RunInTransaction(func(tx core.App) error {
		// Read again inside the transaction: two tabs must not spend the same invite twice.
		invite, err := findInvite(tx, request.Code, now)
		if err != nil {
			return err
		}
		if _, err = tx.FindAuthRecordByEmail("users", email); err == nil {
			return apis.NewApiError(http.StatusConflict, "Já existe uma conta com este email. Entre com a sua senha.", nil)
		}
		users, err := tx.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		user = core.NewRecord(users)
		user.SetEmail(email)
		user.SetPassword(request.Password)
		user.SetVerified(true)
		user.Set("name", name)
		user.Set("role", "player")
		user.Set("terms_version", LegalVersion)
		user.Set("terms_accepted_at", dateTime(now))
		user.Set("adult_confirmed_at", dateTime(now))
		user.Set("wave", invite.GetInt("wave"))
		if err = tx.Save(user); err != nil {
			return err
		}
		invite.Set("used_at", dateTime(now))
		invite.Set("user", user.Id)
		if err = tx.Save(invite); err != nil {
			return err
		}
		if entry, err := tx.FindFirstRecordByData("waitlist", "email", email); err == nil {
			entry.Set("status", "joined")
			return tx.Save(entry)
		}
		return nil
	})
	if err == nil {
		trackEvent(app, user.Id, "signup", strconv.Itoa(user.GetInt("wave")), nil)
	}
	return user, err
}

// requestPasswordReset always looks successful to the caller (no email discovery).
func requestPasswordReset(app core.App, emailValue, base string, now time.Time) error {
	email, ok := normalizeEmail(emailValue)
	if !ok {
		return apis.NewBadRequestError("Informe um email válido.", nil)
	}
	user, err := app.FindAuthRecordByEmail("users", email)
	if err != nil || !expired(user, "reset_sent_at", resetResendAfter, now) {
		return nil
	}
	if _, suspended := suspendedUntil(user, now); suspended {
		return nil
	}
	token, err := user.NewPasswordResetToken()
	if err != nil {
		return err
	}
	user.Set("reset_sent_at", dateTime(now))
	if err = app.Save(user); err != nil {
		return err
	}
	ttl := time.Duration(user.Collection().PasswordResetToken.Duration) * time.Second
	err = sendGameMail(app, gameMail{
		To: email, Kind: "password", Subject: "Nova senha do Café Mania", Title: "Vamos criar uma senha nova",
		Paragraphs: []string{
			"Recebemos um pedido para trocar a senha da sua conta do Café Mania.",
			"O link vale por " + formatMinutes(ttl) + " e só funciona uma vez. Ao trocar a senha, você sai de todos os aparelhos.",
		},
		Button: "Criar nova senha", Link: base + "/senha#" + token,
	}, base)
	if err != nil {
		app.Logger().Error("Falha ao enviar o email de nova senha", "error", err)
		return apis.NewApiError(http.StatusServiceUnavailable, "Não foi possível enviar o email agora. Tente de novo em alguns minutos.", nil)
	}
	return nil
}

func formatMinutes(d time.Duration) string {
	if d >= time.Hour && d%time.Hour == 0 {
		hours := int(d / time.Hour)
		if hours == 1 {
			return "1 hora"
		}
		return strconv.Itoa(hours) + " horas"
	}
	return strconv.Itoa(int(d/time.Minute)) + " minutos"
}

// setPassword changes the password and ends every session of the account.
func setPassword(app core.App, user *core.Record, password string) error {
	user.SetPassword(password)
	user.RefreshTokenKey()
	if err := app.Save(user); err != nil {
		return err
	}
	kickUser(app, user.Id)
	return nil
}

func resetPassword(app core.App, token, password, confirm string) error {
	user, err := app.FindAuthRecordByToken(token, core.TokenTypePasswordReset)
	if err != nil || user.Collection().Name != "users" {
		return apis.NewApiError(http.StatusGone, "Este link é inválido, já foi usado ou venceu. Peça outro.", nil)
	}
	if err = checkPassword(password, confirm, user.Email()); err != nil {
		return err
	}
	if err = setPassword(app, user, password); err != nil {
		return err
	}
	trackEvent(app, user.Id, "password_reset", "", nil)
	return nil
}

// apiError keeps validation messages and hides internal failures.
func apiError(r *core.RequestEvent, err error, fallback string) error {
	var api *router.ApiError
	if errors.As(err, &api) {
		return api
	}
	return r.InternalServerError(fallback, err)
}

func registerAccessRoutes(e *core.ServeEvent) {
	noStore := func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		return r.Next()
	}
	e.Router.GET("/api/coffe/access/config", func(r *core.RequestEvent) error {
		return r.JSON(http.StatusOK, map[string]any{
			"legalVersion": LegalVersion, "minimumAge": minimumAge, "turnstileSiteKey": turnstileSiteKey(),
			"contactEmail": os.Getenv("COFFE_CONTACT_EMAIL"), "devMailbox": !mailConfigured() && !isProduction(),
		})
	}).BindFunc(noStore)
	e.Router.POST("/api/coffe/waitlist", func(r *core.RequestEvent) error {
		var body waitlistRequest
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		if body.Website != "" {
			return r.JSON(http.StatusAccepted, map[string]bool{"ok": true})
		}
		if !verifyTurnstile(r.Request.Context(), body.Turnstile, r.RealIP()) {
			return r.BadRequestError("Não foi possível confirmar que você não é um robô. Tente de novo.", nil)
		}
		if err := joinWaitlist(r.App, body, publicBase(r), time.Now()); err != nil {
			return apiError(r, err, "Não foi possível entrar na lista agora.")
		}
		return r.JSON(http.StatusAccepted, map[string]bool{"ok": true})
	}).Bind(apis.BodyLimit(4096)).BindFunc(noStore, sameOrigin)
	e.Router.POST("/api/coffe/waitlist/confirm", func(r *core.RequestEvent) error {
		var body struct {
			Token string `json:"token"`
		}
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		position, err := confirmWaitlist(r.App, body.Token, time.Now())
		if err != nil {
			return apiError(r, err, "Não foi possível confirmar agora.")
		}
		return r.JSON(http.StatusOK, map[string]int{"position": position})
	}).Bind(apis.BodyLimit(1024)).BindFunc(noStore, sameOrigin)
	e.Router.POST("/api/coffe/invite/check", func(r *core.RequestEvent) error {
		var body struct {
			Code string `json:"code"`
		}
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		invite, err := findInvite(r.App, body.Code, time.Now())
		if err != nil {
			return err
		}
		return r.JSON(http.StatusOK, map[string]any{"email": invite.GetString("email"), "expiresAt": invite.GetDateTime("expires_at").Time().UnixMilli()})
	}).Bind(apis.BodyLimit(1024)).BindFunc(noStore, sameOrigin)
	e.Router.POST("/api/coffe/signup", func(r *core.RequestEvent) error {
		var body signupRequest
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		user, err := signup(r.App, body, time.Now())
		if err != nil {
			return apiError(r, err, "Não foi possível criar a conta agora.")
		}
		token, err := user.NewAuthToken()
		if err != nil {
			return r.InternalServerError("Conta criada; entre com o seu email e senha.", err)
		}
		setSessionCookie(r, token, sessionLifetime)
		return r.JSON(http.StatusCreated, sessionView(user))
	}).Bind(apis.BodyLimit(4096)).BindFunc(noStore, sameOrigin)
	e.Router.POST("/api/coffe/password/forgot", func(r *core.RequestEvent) error {
		var body struct {
			Email     string `json:"email"`
			Turnstile string `json:"turnstile"`
		}
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		if !verifyTurnstile(r.Request.Context(), body.Turnstile, r.RealIP()) {
			return r.BadRequestError("Não foi possível confirmar que você não é um robô. Tente de novo.", nil)
		}
		if err := requestPasswordReset(r.App, body.Email, publicBase(r), time.Now()); err != nil {
			return apiError(r, err, "Não foi possível pedir a nova senha agora.")
		}
		return r.JSON(http.StatusAccepted, map[string]bool{"ok": true})
	}).Bind(apis.BodyLimit(4096)).BindFunc(noStore, sameOrigin)
	e.Router.POST("/api/coffe/password/reset", func(r *core.RequestEvent) error {
		var body struct {
			Token           string `json:"token"`
			Password        string `json:"password"`
			PasswordConfirm string `json:"passwordConfirm"`
		}
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		if err := resetPassword(r.App, body.Token, body.Password, body.PasswordConfirm); err != nil {
			return apiError(r, err, "Não foi possível trocar a senha agora.")
		}
		clearSessionCookie(r)
		return r.NoContent(http.StatusNoContent)
	}).Bind(apis.BodyLimit(4096)).BindFunc(noStore, sameOrigin)

	admin := e.Router.Group("/api/coffe/admin/invites")
	admin.BindFunc(noStore, requireAdmin, sameOrigin)
	// Invites the N oldest confirmed people of the waitlist (one wave).
	admin.POST("/waitlist", func(r *core.RequestEvent) error {
		var body struct {
			Count int `json:"count"`
			Wave  int `json:"wave"`
			Days  int `json:"days"`
		}
		if r.BindBody(&body) != nil || body.Count < 1 || body.Count > 200 || body.Wave < 1 || body.Days < 0 || body.Days > 60 {
			return r.BadRequestError("Informe quantidade (1 a 200), onda e validade em dias (até 60).", nil)
		}
		invited, err := inviteWaitlist(r.App, body.Count, body.Wave, inviteTTL(body.Days), sessionRecord(r).Id, publicBase(r), time.Now())
		if err != nil {
			return apiError(r, err, "Não foi possível convidar a lista agora.")
		}
		return r.JSON(http.StatusOK, map[string]any{"invited": invited})
	})
	// One invite for a specific email (the first wave is friends of the project). The link is
	// returned once, to be shared by hand when needed.
	admin.POST("", func(r *core.RequestEvent) error {
		var body struct {
			Email string `json:"email"`
			Wave  int    `json:"wave"`
			Days  int    `json:"days"`
			Send  bool   `json:"send"`
		}
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		email, ok := normalizeEmail(body.Email)
		if !ok || body.Wave < 1 || body.Days < 0 || body.Days > 60 {
			return r.BadRequestError("Informe email, onda e validade em dias (até 60).", nil)
		}
		if _, err := r.App.FindAuthRecordByEmail("users", email); err == nil {
			return r.BadRequestError("Este email já tem conta.", nil)
		}
		now := time.Now()
		ttl := inviteTTL(body.Days)
		code, _, err := issueInvite(r.App, email, body.Wave, "admin", sessionRecord(r).Id, ttl, now)
		if err != nil {
			return r.InternalServerError("Não foi possível criar o convite.", err)
		}
		base := publicBase(r)
		if body.Send {
			if err = sendGameMail(r.App, inviteMail(email, code, base, now.Add(ttl)), base); err != nil {
				return r.InternalServerError("Convite criado, mas o email falhou. Use o link.", err)
			}
		}
		return r.JSON(http.StatusOK, map[string]any{"email": email, "link": base + "/convite#" + code, "sent": body.Send})
	})
}

func inviteTTL(days int) time.Duration {
	if days == 0 {
		return defaultInviteTTL
	}
	return time.Duration(days) * 24 * time.Hour
}

func inviteWaitlist(app core.App, count, wave int, ttl time.Duration, admin, base string, now time.Time) ([]string, error) {
	entries, err := app.FindRecordsByFilter("waitlist", "status = 'confirmed'", "confirmed_at", count, 0)
	if err != nil {
		return nil, err
	}
	invited := []string{}
	for _, entry := range entries {
		email := entry.GetString("email")
		code, _, err := issueInvite(app, email, wave, "waitlist", admin, ttl, now)
		if err != nil {
			return invited, err
		}
		if err = sendGameMail(app, inviteMail(email, code, base, now.Add(ttl)), base); err != nil {
			app.Logger().Error("Falha ao enviar convite", "email", email, "error", err)
			continue
		}
		entry.Set("status", "invited")
		entry.Set("invited_at", dateTime(now))
		if err = app.Save(entry); err != nil {
			return invited, err
		}
		invited = append(invited, email)
	}
	return invited, nil
}
