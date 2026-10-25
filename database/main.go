package main

import (
	"bytes"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"

	"coffe-mania/database/playerstate"
	"coffe-mania/shared/buildinfo"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	_ "coffe-mania/database/migrations"
)

func main() {
	if err := checkProductionConfig(); err != nil {
		log.Fatal(err)
	}
	app := pocketbase.New()
	playerstate.RegisterValidation(app)
	registerAccountHooks(app)
	registerLedgerHooks(app)
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{Automigrate: false})
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.InstallerFunc = nil
		log.Printf("Café Mania %s: PocketBase", buildinfo.Version)
		if err := applyServerSettings(e.App); err != nil {
			return err
		}
		registerOperationStatus(e)
		registerSessionRoutes(e)
		registerAccessRoutes(e)
		registerAccountRoutes(e)
		registerPlayerStateRoutes(e)
		registerAppearanceRoutes(e)
		registerNpcAppearanceRoutes(e)
		if err := registerGameBridge(e); err != nil {
			return err
		}
		if err := registerTelemetry(e); err != nil {
			return err
		}
		startRoomActivityWatchdog(e.App)
		registerCookingRoutes(e)
		registerJuiceRoutes(e)
		registerSupplyRoutes(e)
		registerWaiterRoutes(e)
		registerDevRoutes(e)
		registerRoomRoutes(e)
		publicDir := os.Getenv("COFFE_PUBLIC_DIR")
		if publicDir == "" {
			publicDir = "../game/dist"
		}
		publicDir, err := filepath.Abs(publicDir)
		if err != nil {
			return err
		}
		registerPageRoutes(e, publicDir)
		return e.Next()
	})
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

var safeHost = regexp.MustCompile(`^[A-Za-z0-9.-]+(:[0-9]+)?$`)

// setPageHeaders protects the game pages: scripts only from the game itself (and the
// Turnstile widget), no framing by other sites, sockets only to this host. Pixi runs
// without eval (pixi.js/unsafe-eval is imported by the client).
func setPageHeaders(r *core.RequestEvent) {
	sockets := "'self'"
	if public := os.Getenv("COFFE_PUBLIC_URL"); public != "" {
		if parsed, err := url.Parse(public); err == nil && safeHost.MatchString(parsed.Host) {
			sockets += " wss://" + parsed.Host
		}
	} else if safeHost.MatchString(r.Request.Host) {
		sockets += " ws://" + r.Request.Host + " wss://" + r.Request.Host
	}
	header := r.Response.Header()
	header.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; "+
		"frame-src https://challenges.cloudflare.com; connect-src "+sockets+"; img-src 'self' data: blob:; media-src 'self' data: blob:; "+
		"font-src 'self' data:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; "+
		"form-action 'self'; frame-ancestors 'none'")
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	header.Set("X-Frame-Options", "DENY")
}

func registerPageRoutes(e *core.ServeEvent, publicDir string) {
	page := func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		setPageHeaders(r)
		index, err := os.ReadFile(filepath.Join(publicDir, "index.html"))
		if err != nil || !bytes.Contains(index, []byte(`name="coffe-auth"`)) {
			return r.String(http.StatusServiceUnavailable, "Frontend indisponível ou desatualizado. Execute npm run build na raiz do projeto.")
		}
		return r.HTML(http.StatusOK, string(index))
	}
	play := func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		if sessionRecord(r) == nil {
			clearSessionCookie(r)
			room := r.Request.URL.Query().Get("room")
			if room != "" {
				return r.Redirect(http.StatusSeeOther, "/?room="+url.QueryEscape(room))
			}
			return r.Redirect(http.StatusSeeOther, "/")
		}
		return page(r)
	}
	e.Router.GET("/{$}", page)
	e.Router.GET("/index.html", page)
	e.Router.GET("/play", play)
	e.Router.GET("/play/{$}", play)
	// Pages of the access flow; their secrets travel in the URL fragment, never to the server.
	for _, path := range []string{"/convite", "/lista/confirmar", "/senha", "/conta", "/termos", "/privacidade", "/conduta", "/admin/metricas"} {
		e.Router.GET(path, page)
	}
	// Public art can be cached independently; only pages and game APIs carry user state.
	e.Router.GET("/{path...}", apis.Static(os.DirFS(publicDir), false))
}
