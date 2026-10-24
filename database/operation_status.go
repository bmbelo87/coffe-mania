package main

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"coffe-mania/database/migrations"
	"coffe-mania/shared/buildinfo"
	"coffe-mania/shared/gamewire"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

const (
	defaultMaintenanceMessage = "O Café Mania está em manutenção. Voltamos em breve!"
	defaultClosedMessage      = "O alpha do Café Mania foi encerrado. Obrigado por jogar com a gente!"
	// A scheduled maintenance is announced at most a week ahead.
	maxMaintenanceNotice = 7 * 24 * time.Hour
)

// statusCache keeps the single game_status row in memory: every locked request reads it.
type statusCache struct {
	mu     sync.RWMutex
	value  gamewire.OperationStatus
	loaded bool
}

func statusStore(app core.App) *statusCache {
	return app.Store().GetOrSet("operationStatus", func() any { return &statusCache{} }).(*statusCache)
}

func readStatusRecord(app core.App) gamewire.OperationStatus {
	record, err := app.FindRecordById("game_status", migrations.StatusRecordID)
	if err != nil {
		// Fail open only when the row is missing: an unreadable database fails every route anyway.
		return gamewire.OperationStatus{Mode: gamewire.ModeOpen}
	}
	millis := func(field string) int64 {
		if value := record.GetDateTime(field); !value.IsZero() {
			return value.Time().UnixMilli()
		}
		return 0
	}
	status := gamewire.OperationStatus{Mode: record.GetString("mode"), Message: record.GetString("message"), StartsAt: millis("starts_at"), EndsAt: millis("ends_at")}
	if status.Mode == "" {
		status.Mode = gamewire.ModeOpen
	}
	if status.Message == "" {
		switch status.Mode {
		case gamewire.ModeMaintenance:
			status.Message = defaultMaintenanceMessage
		case gamewire.ModeClosed:
			status.Message = defaultClosedMessage
		}
	}
	return status
}

func currentStatus(app core.App) gamewire.OperationStatus {
	cache := statusStore(app)
	cache.mu.RLock()
	value, loaded := cache.value, cache.loaded
	cache.mu.RUnlock()
	if loaded {
		return value
	}
	return reloadStatus(app)
}

func reloadStatus(app core.App) gamewire.OperationStatus {
	value := readStatusRecord(app)
	cache := statusStore(app)
	cache.mu.Lock()
	cache.value, cache.loaded = value, true
	cache.mu.Unlock()
	return value
}

// pushStatus tells the room service at once, so players see the countdown and are moved out
// when maintenance starts. The service also reads the mode when it starts.
func pushStatus(app core.App, status gamewire.OperationStatus) {
	client := roomService(app)
	if client == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := client.request(ctx, "status", status, nil); err != nil {
			app.Logger().Warn("Falha ao avisar o serviço do quarto sobre o modo de operação", "error", err)
		}
	}()
}

type statusView struct {
	gamewire.OperationStatus
	Active    bool   `json:"active"`
	ServerNow int64  `json:"serverNow"`
	Version   string `json:"version"`
}

func viewStatus(status gamewire.OperationStatus, now time.Time) statusView {
	return statusView{OperationStatus: status, Active: status.Active(now.UnixMilli()), ServerNow: now.UnixMilli(), Version: buildinfo.Version}
}

// lockedPath lists what ordinary players cannot use while the game is locked. Session,
// status, admin and the internal bridge stay available so staff can sign in and reopen.
func lockedPath(path string) bool {
	if path == "/play" || path == "/play/" || path == "/api/realtime" {
		return true
	}
	if !strings.HasPrefix(path, "/api/coffe/") {
		return false
	}
	// Joining the waitlist, recovering a password or deleting an account also stays open;
	// creating an account (signup) does not.
	for _, open := range []string{"/api/coffe/session", "/api/coffe/status", "/api/coffe/admin", "/api/coffe/game-internal",
		"/api/coffe/access", "/api/coffe/waitlist", "/api/coffe/invite", "/api/coffe/password", "/api/coffe/account"} {
		if path == open || strings.HasPrefix(path, open+"/") {
			return false
		}
	}
	return true
}

func operationGate(r *core.RequestEvent) error {
	status := currentStatus(r.App)
	if !status.Active(time.Now().UnixMilli()) || !lockedPath(r.Request.URL.Path) {
		return r.Next()
	}
	if user := sessionRecord(r); user != nil && isStaff(user) {
		return r.Next()
	}
	if strings.HasPrefix(r.Request.URL.Path, "/play") {
		r.Response.Header().Set("Cache-Control", "no-store")
		return r.Redirect(http.StatusSeeOther, "/")
	}
	r.Response.Header().Set("Cache-Control", "no-store")
	return r.JSON(http.StatusServiceUnavailable, map[string]any{
		"status": http.StatusServiceUnavailable, "code": status.Mode, "message": status.Message, "endsAt": status.EndsAt,
	})
}

// requireAdmin guards the administration routes (game status, invites, later the panel).
func requireAdmin(r *core.RequestEvent) error {
	user := sessionRecord(r)
	if user == nil {
		return r.UnauthorizedError("Entre para continuar.", nil)
	}
	if !isAdmin(user) {
		return r.ForbiddenError("Acesso restrito à administração.", nil)
	}
	return r.Next()
}

type statusCommand struct {
	Mode     string `json:"mode"`
	Message  string `json:"message"`
	StartsAt int64  `json:"startsAt"`
	EndsAt   int64  `json:"endsAt"`
}

func saveStatus(app core.App, command statusCommand, now time.Time) (gamewire.OperationStatus, error) {
	switch command.Mode {
	case gamewire.ModeOpen, gamewire.ModeMaintenance, gamewire.ModeClosed:
	default:
		return gamewire.OperationStatus{}, apis.NewBadRequestError("Modo inválido.", nil)
	}
	message := strings.TrimSpace(command.Message)
	if len([]rune(message)) > 500 {
		return gamewire.OperationStatus{}, apis.NewBadRequestError("A mensagem passa de 500 caracteres.", nil)
	}
	if command.StartsAt < 0 || command.EndsAt < 0 || command.StartsAt > now.Add(maxMaintenanceNotice).UnixMilli() ||
		command.EndsAt != 0 && command.EndsAt < max(command.StartsAt, now.UnixMilli()) {
		return gamewire.OperationStatus{}, apis.NewBadRequestError("Horários inválidos.", nil)
	}
	record, err := app.FindRecordById("game_status", migrations.StatusRecordID)
	if err != nil {
		return gamewire.OperationStatus{}, err
	}
	date := func(ms int64) any {
		if ms == 0 || command.Mode == gamewire.ModeOpen {
			return ""
		}
		value, _ := types.ParseDateTime(time.UnixMilli(ms).UTC())
		return value
	}
	record.Set("mode", command.Mode)
	record.Set("message", message)
	record.Set("starts_at", date(command.StartsAt))
	record.Set("ends_at", date(command.EndsAt))
	if err = app.Save(record); err != nil {
		return gamewire.OperationStatus{}, err
	}
	return reloadStatus(app), nil
}

func registerOperationStatus(e *core.ServeEvent) {
	refresh := func(record *core.RecordEvent) error {
		if err := record.Next(); err != nil {
			return err
		}
		pushStatus(record.App, reloadStatus(record.App))
		return nil
	}
	// Any save (admin route or PocketBase dashboard) updates the cache and the room service.
	e.App.OnRecordAfterUpdateSuccess("game_status").BindFunc(refresh)
	e.App.OnRecordAfterCreateSuccess("game_status").BindFunc(refresh)
	reloadStatus(e.App)
	e.Router.BindFunc(rateLimitGame, operationGate)

	e.Router.GET("/api/coffe/status", func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		return r.JSON(http.StatusOK, viewStatus(currentStatus(r.App), time.Now()))
	})
	admin := e.Router.Group("/api/coffe/admin")
	admin.BindFunc(func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		return r.Next()
	}, requireAdmin)
	admin.POST("/status", func(r *core.RequestEvent) error {
		var command statusCommand
		if err := r.BindBody(&command); err != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		status, err := saveStatus(r.App, command, time.Now())
		if err != nil {
			return err
		}
		return r.JSON(http.StatusOK, viewStatus(status, time.Now()))
	}).Bind(apis.BodyLimit(2048)).BindFunc(sameOrigin)
}
