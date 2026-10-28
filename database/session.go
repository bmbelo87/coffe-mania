package main

import (
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

const sessionCookie = "coffe_session"
const sessionLifetime = 7 * 24 * 60 * 60

type playerSession struct {
	PlayerID    string `json:"playerId"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
	DevTools    bool   `json:"devTools"`
	Role        string `json:"role"`
	Staff       bool   `json:"staff"`
}

// sessionRecord is the only way game routes identify a player. A suspended account has no
// session even if a cookie from before the suspension survived somewhere.
func sessionRecord(e *core.RequestEvent) *core.Record {
	cookie, err := e.Request.Cookie(sessionCookie)
	if err != nil || cookie.Value == "" {
		return nil
	}
	record, err := e.App.FindAuthRecordByToken(cookie.Value, core.TokenTypeAuth)
	if err != nil || record.Collection().Name != "users" {
		return nil
	}
	if _, suspended := suspendedUntil(record, time.Now()); suspended {
		return nil
	}
	return record
}

func sessionView(record *core.Record) playerSession {
	name := record.GetString("name")
	if name == "" {
		name = strings.Split(record.Email(), "@")[0]
	}
	return playerSession{PlayerID: record.Id, DisplayName: name, Email: record.Email(), DevTools: devToolsFor(record), Role: accountRole(record), Staff: isStaff(record)}
}

func setSessionCookie(e *core.RequestEvent, token string, maxAge int) {
	isSecure := requestUsesHTTPS(e.Request) || osSecureCookies()
	sameSite := http.SameSiteNoneMode
	if !isSecure {
		sameSite = http.SameSiteLaxMode
	}
	cookie := &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: sameSite,
		MaxAge:   maxAge,
	}
	if maxAge < 0 {
		cookie.Expires = time.Unix(1, 0)
	} else {
		cookie.Expires = time.Now().Add(time.Duration(maxAge) * time.Second)
	}
	http.SetCookie(e.Response, cookie)
}

func clearSessionCookie(e *core.RequestEvent) { setSessionCookie(e, "", -1) }

// Only local reverse proxies (Vite/ngrok) may identify the original TLS scheme.
// LAN/direct requests cannot forge this header to bypass origin validation.
func requestUsesHTTPS(request *http.Request) bool {
	if request.TLS != nil || osSecureCookies() {
		return true
	}
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback() && strings.EqualFold(request.Header.Get("X-Forwarded-Proto"), "https")
}

func isAllowedHost(host, reqHost string) bool {
	h := strings.ToLower(host)
	rh := strings.ToLower(reqHost)
	if h == rh {
		return true
	}
	if hHost, _, err := net.SplitHostPort(h); err == nil {
		h = hHost
	}
	if rhHost, _, err := net.SplitHostPort(rh); err == nil {
		rh = rhHost
	}
	if h == rh {
		return true
	}
	if h == "localhost" || h == "127.0.0.1" {
		return true
	}
	if strings.HasSuffix(h, ".vercel.app") || strings.HasSuffix(h, ".onrender.com") {
		return true
	}
	return false
}

// Cookie authentication needs an origin check for mutations, including login/logout.
// Browsers send Origin on every POST; a mutation without it does not come from the game.
func sameOrigin(e *core.RequestEvent) error {
	origin := e.Request.Header.Get("Origin")
	if origin == "" {
		if e.Request.Method == http.MethodGet || e.Request.Method == http.MethodHead {
			return e.Next()
		}
		return e.ForbiddenError("Origem inválida.", nil)
	}
	parsed, err := url.Parse(origin)
	if err != nil || !isAllowedHost(parsed.Host, e.Request.Host) {
		return e.ForbiddenError("Origem inválida.", nil)
	}
	return e.Next()
}

func registerSessionRoutes(e *core.ServeEvent) {
	g := e.Router.Group("/api/coffe/session")
	g.BindFunc(func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		return r.Next()
	})
	g.GET("", func(r *core.RequestEvent) error {
		record := sessionRecord(r)
		if record == nil {
			clearSessionCookie(r)
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		return r.JSON(http.StatusOK, sessionView(record))
	})
	// Single Sign-On (SSO) do Varal: autentica ou cria o jogador sem necessidade de segundo cadastro
	g.GET("/varal", func(r *core.RequestEvent) error {
		u := strings.ToLower(strings.TrimSpace(r.Request.URL.Query().Get("u")))
		if u == "" {
			return r.Redirect(http.StatusSeeOther, "/play")
		}
		var cleanU strings.Builder
		for _, ch := range u {
			if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '-' {
				cleanU.WriteRune(ch)
			}
		}
		username := cleanU.String()
		if username == "" {
			username = "jogador"
		}
		displayName := strings.TrimSpace(r.Request.URL.Query().Get("name"))
		if displayName == "" {
			displayName = username
		}
		if len(displayName) > 30 {
			displayName = displayName[:30]
		}

		email := username + "@varal.social"
		record, err := r.App.FindAuthRecordByEmail("users", email)
		if err != nil {
			users, err := r.App.FindCollectionByNameOrId("users")
			if err != nil {
				return r.InternalServerError("Falha ao acessar coleção de usuários.", err)
			}
			record = core.NewRecord(users)
			record.SetEmail(email)
			record.SetPassword("varal_" + username + "_secret_2026")
			record.SetVerified(true)
			record.Set("name", displayName)
			if username == "brunobelo" {
				record.Set("role", "admin")
			} else {
				record.Set("role", "player")
			}
			record.Set("terms_version", LegalVersion)
			now := time.Now()
			record.Set("terms_accepted_at", dateTime(now))
			record.Set("adult_confirmed_at", dateTime(now))
			record.Set("wave", 1)
			if err := r.App.Save(record); err != nil {
				return r.InternalServerError("Falha ao registrar usuário do Varal.", err)
			}
			_ = ensureRoom(r.App, record.Id)
		} else {
			if displayName != "" && record.GetString("name") != displayName {
				record.Set("name", displayName)
				_ = r.App.Save(record)
			}
			_ = ensureRoom(r.App, record.Id)
		}

		token, err := record.NewAuthToken()
		if err != nil {
			return r.InternalServerError("Falha ao gerar token de sessão.", err)
		}
		setSessionCookie(r, token, sessionLifetime)
		return r.Redirect(http.StatusSeeOther, "/play")
	})
	g.POST("/login", func(r *core.RequestEvent) error {
		data := struct {
			Email     string `json:"email"`
			Password  string `json:"password"`
			Turnstile string `json:"turnstile"`
		}{}
		if err := r.BindBody(&data); err != nil || data.Email == "" || data.Password == "" {
			return r.BadRequestError("Informe email e senha.", nil)
		}
		email := strings.ToLower(strings.TrimSpace(data.Email))
		now := time.Now()
		// Unknown emails are counted too, so the challenge does not reveal which accounts exist.
		if accountLogins.needsChallenge(email, now) && !verifyTurnstile(r.Request.Context(), data.Turnstile, r.RealIP()) {
			return r.JSON(http.StatusForbidden, map[string]any{
				"status": http.StatusForbidden, "code": "challenge", "siteKey": turnstileSiteKey(),
				"message": "Muitas tentativas com este email. Confirme que você não é um robô para tentar de novo.",
			})
		}
		record, err := r.App.FindAuthRecordByEmail("users", email)
		if err != nil || !record.ValidatePassword(data.Password) {
			accountLogins.fail(email, now)
			return r.UnauthorizedError("Email ou senha inválidos.", nil)
		}
		accountLogins.succeed(email)
		// Only after the password: the notice must not reveal which emails have accounts.
		if until, suspended := suspendedUntil(record, time.Now()); suspended {
			return suspendedResponse(r, record, until)
		}
		token, err := record.NewAuthToken()
		if err != nil {
			return r.InternalServerError("Não foi possível iniciar a sessão.", err)
		}
		setSessionCookie(r, token, sessionLifetime)
		trackEvent(r.App, record.Id, "login", "", nil)
		return r.JSON(http.StatusOK, sessionView(record))
	}).Bind(apis.BodyLimit(4096)).BindFunc(sameOrigin)
	g.POST("/logout", func(r *core.RequestEvent) error {
		if user := sessionRecord(r); user != nil {
			if client := roomService(r.App); client != nil {
				_ = client.request(r.Request.Context(), "kick", map[string]string{"User": user.Id}, nil)
			}
		}
		clearSessionCookie(r)
		return r.NoContent(http.StatusNoContent)
	}).BindFunc(sameOrigin)
	// Ends the sessions on every device, e.g. after using a shared computer.
	g.POST("/logout-all", func(r *core.RequestEvent) error {
		user := sessionRecord(r)
		if user == nil {
			clearSessionCookie(r)
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		if err := revokeSessions(r.App, user); err != nil {
			return r.InternalServerError("Não foi possível encerrar as sessões.", err)
		}
		clearSessionCookie(r)
		return r.NoContent(http.StatusNoContent)
	}).BindFunc(sameOrigin)
}
