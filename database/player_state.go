package main

import (
	"errors"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"

	"coffe-mania/database/playerstate"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func registerPlayerStateRoutes(e *core.ServeEvent) {
	e.Router.POST("/api/coffe/cafe-name", func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		user := sessionRecord(r)
		if user == nil {
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		var command struct {
			Name    string `json:"name"`
			Initial bool   `json:"initial"`
		}
		if err := r.BindBody(&command); err != nil {
			return r.BadRequestError("Nome inválido.", nil)
		}
		for _, char := range command.Name {
			if unicode.IsControl(char) || unicode.Is(unicode.Cf, char) {
				return r.BadRequestError("Use apenas caracteres visíveis no nome.", nil)
			}
		}
		name := strings.Join(strings.Fields(command.Name), " ")
		if size := utf8.RuneCountInString(name); size < 1 || size > 40 {
			return r.BadRequestError("Escolha um nome de 1 a 40 caracteres.", nil)
		}
		if _, err := playerstate.GetOrCreate(r.App, user.Id); err != nil {
			return r.InternalServerError("Não foi possível carregar seu café.", err)
		}
		alreadyChosen := errors.New("cafe name already chosen")
		var snapshot playerstate.Snapshot
		err := r.App.RunInTransaction(func(tx core.App) error {
			record, err := tx.FindFirstRecordByData(playerstate.Collection, "user", user.Id)
			if err != nil {
				return err
			}
			// A stale first-entry screen must not overwrite a name chosen in another tab.
			if command.Initial && record.GetBool("cafe_name_chosen") {
				return alreadyChosen
			}
			record.Set("cafe_name", name)
			record.Set("cafe_name_chosen", true)
			if err := tx.Save(record); err != nil {
				return err
			}
			snapshot = playerstate.View(record)
			return nil
		})
		if errors.Is(err, alreadyChosen) {
			return r.JSON(http.StatusConflict, map[string]string{"message": "O nome já foi escolhido em outra aba. Recarregue para continuar."})
		}
		if err != nil {
			return r.InternalServerError("Não foi possível salvar o nome do café.", err)
		}
		return r.JSON(http.StatusOK, snapshot)
	}).Bind(apis.BodyLimit(2048)).BindFunc(sameOrigin)

	e.Router.POST("/api/coffe/level-ups/ack", func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		user := sessionRecord(r)
		if user == nil {
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		var command struct {
			Level int `json:"level"`
		}
		if err := r.BindBody(&command); err != nil || command.Level < 2 || command.Level > playerstate.MaxLevel() {
			return r.BadRequestError("Nível inválido.", nil)
		}
		err := r.App.RunInTransaction(func(tx core.App) error {
			record, err := tx.FindFirstRecordByData(playerstate.Collection, "user", user.Id)
			if err != nil {
				return err
			}
			playerstate.AcknowledgeLevel(record, command.Level)
			return tx.Save(record)
		})
		if err != nil {
			return r.InternalServerError("Não foi possível confirmar o aviso.", err)
		}
		return r.NoContent(http.StatusNoContent)
	}).Bind(apis.BodyLimit(1024)).BindFunc(sameOrigin)
	// PocketBase normally authenticates subscriptions with an Authorization
	// header. The game keeps its token in an HttpOnly cookie instead. Authenticate
	// BEFORE the native handler compares this request with the client's auth.
	// Header authentication remains untouched for the dashboard and SDK clients.
	e.Router.BindFunc(func(r *core.RequestEvent) error {
		if r.Request.Method != http.MethodPost || r.Request.URL.Path != "/api/realtime" || r.Request.Header.Get("Authorization") != "" {
			return r.Next()
		}
		r.Auth = sessionRecord(r)
		if r.Auth == nil {
			clearSessionCookie(r)
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		return sameOrigin(r)
	})
	e.Router.GET("/api/coffe/player-state", func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		user := sessionRecord(r)
		if user == nil {
			clearSessionCookie(r)
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		// Never accept a player id from the browser: the cookie identifies the owner.
		record, err := playerstate.GetOrCreate(r.App, user.Id)
		if err != nil {
			return r.InternalServerError("Não foi possível carregar os dados do jogador.", err)
		}
		return r.JSON(http.StatusOK, playerstate.View(record))
	})
}
