package main

import (
	"net/http"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// userRelations lists every collection field that points at the account. All of them delete
// in cascade with the user; export reads the same list, so new collections are covered.
func userRelations(app core.App) (map[string][]string, error) {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return nil, err
	}
	collections, err := app.FindAllCollections(core.CollectionTypeBase)
	if err != nil {
		return nil, err
	}
	out := map[string][]string{}
	for _, collection := range collections {
		for _, field := range collection.Fields {
			// created_by points at the admin who issued an invite: it is not that admin's data.
			if relation, ok := field.(*core.RelationField); ok && relation.CollectionId == users.Id && relation.Name != "created_by" {
				out[collection.Name] = append(out[collection.Name], relation.Name)
			}
		}
	}
	return out, nil
}

// exportAccount gathers the player's data (LGPD access right). Hidden fields such as token
// hashes stay out.
func exportAccount(app core.App, user *core.Record) (map[string]any, error) {
	relations, err := userRelations(app)
	if err != nil {
		return nil, err
	}
	data := map[string]any{}
	for collection, fields := range relations {
		var rows []any
		for _, field := range fields {
			records, err := app.FindRecordsByFilter(collection, field+" ?= {:id}", "", 5000, 0, dbx.Params{"id": user.Id})
			if err != nil {
				return nil, err
			}
			for _, record := range records {
				rows = append(rows, record.PublicExport())
			}
		}
		if len(rows) > 0 {
			data[collection] = rows
		}
	}
	if entry, err := app.FindFirstRecordByData("waitlist", "email", user.Email()); err == nil {
		data["waitlist"] = entry.PublicExport()
	}
	telemetry, err := exportTelemetry(app, user.Id)
	if err != nil {
		return nil, err
	}
	if telemetry != nil {
		data["telemetry"] = telemetry
	}
	return map[string]any{
		"exportedAt": time.Now().UTC().Format(time.RFC3339),
		"account": map[string]any{
			"id": user.Id, "email": user.Email(), "name": user.GetString("name"), "role": accountRole(user),
			"created": user.GetDateTime("created").String(), "termsVersion": user.GetString("terms_version"),
			"termsAcceptedAt": user.GetDateTime("terms_accepted_at").String(), "adultConfirmedAt": user.GetDateTime("adult_confirmed_at").String(),
			"wave": user.GetInt("wave"),
		},
		"data": data,
	}, nil
}

// deleteAccount removes the account, everything that cascades from it (café, inventory,
// progress…), its waitlist entry and its telemetry rows.
func deleteAccount(app core.App, user *core.Record) error {
	err := app.RunInTransaction(func(tx core.App) error {
		if entry, err := tx.FindFirstRecordByData("waitlist", "email", user.Email()); err == nil {
			if err = tx.Delete(entry); err != nil {
				return err
			}
		}
		return tx.Delete(user)
	})
	if err == nil {
		kickUser(app, user.Id)
		if err := forgetTelemetryUser(app, user.Id); err != nil {
			app.Logger().Error("Não foi possível apagar a telemetria da conta excluída", "user", user.Id, "error", err)
		}
	}
	return err
}

func registerAccountRoutes(e *core.ServeEvent) {
	group := e.Router.Group("/api/coffe/account")
	group.BindFunc(func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		if sessionRecord(r) == nil {
			return r.UnauthorizedError("Entre para continuar.", nil)
		}
		return r.Next()
	})
	group.POST("/password", func(r *core.RequestEvent) error {
		var body struct {
			Current         string `json:"current"`
			Password        string `json:"password"`
			PasswordConfirm string `json:"passwordConfirm"`
		}
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		user := sessionRecord(r)
		if !user.ValidatePassword(body.Current) {
			return r.BadRequestError("A senha atual não confere.", nil)
		}
		if err := checkPassword(body.Password, body.PasswordConfirm, user.Email()); err != nil {
			return err
		}
		if err := setPassword(r.App, user, body.Password); err != nil {
			return r.InternalServerError("Não foi possível trocar a senha.", err)
		}
		// The other devices leave; this one continues with a new session.
		token, err := user.NewAuthToken()
		if err != nil {
			clearSessionCookie(r)
			return r.NoContent(http.StatusNoContent)
		}
		setSessionCookie(r, token, sessionLifetime)
		return r.NoContent(http.StatusNoContent)
	}).Bind(apis.BodyLimit(4096)).BindFunc(sameOrigin)
	group.GET("/export", func(r *core.RequestEvent) error {
		data, err := exportAccount(r.App, sessionRecord(r))
		if err != nil {
			return r.InternalServerError("Não foi possível reunir os seus dados.", err)
		}
		r.Response.Header().Set("Content-Disposition", `attachment; filename="cafe-mania-meus-dados.json"`)
		return r.JSON(http.StatusOK, data)
	})
	group.POST("/delete", func(r *core.RequestEvent) error {
		var body struct {
			Password string `json:"password"`
		}
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		user := sessionRecord(r)
		if !user.ValidatePassword(body.Password) {
			return r.BadRequestError("A senha não confere.", nil)
		}
		if err := deleteAccount(r.App, user); err != nil {
			return r.InternalServerError("Não foi possível excluir a conta.", err)
		}
		clearSessionCookie(r)
		return r.NoContent(http.StatusNoContent)
	}).Bind(apis.BodyLimit(1024)).BindFunc(sameOrigin)
}
