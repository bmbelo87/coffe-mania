package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"coffe-mania/database/playerstate"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestCafeNameRoutePersistsAndProtectsFirstChoice(t *testing.T) {
	app, owner := newCookingTestApp(t)
	state, err := playerstate.GetOrCreate(app, owner)
	if err != nil {
		t.Fatal(err)
	}
	if playerstate.View(state).CafeNameChosen {
		t.Fatal("new café already named")
	}
	cash, gold := state.GetInt64("cash"), state.GetInt64("gold")
	user, _ := app.FindRecordById("users", owner)
	token, err := user.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	collection, _ := app.FindCollectionByNameOrId("users")
	other := core.NewRecord(collection)
	other.SetEmail("other@local.mail")
	other.SetPassword("123456")
	if err := app.Save(other); err != nil {
		t.Fatal(err)
	}
	otherState, err := playerstate.GetOrCreate(app, other.Id)
	if err != nil {
		t.Fatal(err)
	}
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	registerPlayerStateRoutes(&core.ServeEvent{App: app, Router: router})
	handler, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		label, body, origin string
		cookie              bool
		status              int
		want                string
	}{
		{"anonymous", `{"name":"Outro"}`, "http://localhost", false, 401, ""},
		{"foreign-origin", `{"name":"Outro"}`, "https://elsewhere.invalid", true, 403, ""},
		{"empty", `{"name":"   "}`, "http://localhost", true, 400, ""},
		{"too-long", `{"name":"` + strings.Repeat("á", 41) + `"}`, "http://localhost", true, 400, ""},
		{"control", `{"name":"Café\nnovo"}`, "http://localhost", true, 400, ""},
		{"first-choice", `{"name":"  Café   do João ☕  ","initial":true,"userId":"` + other.Id + `"}`, "http://localhost", true, 200, "Café do João ☕"},
		{"stale-tab", `{"name":"Sobrescrever","initial":true}`, "http://localhost", true, 409, ""},
		{"rename", `{"name":"Meu Café","initial":false}`, "http://localhost", true, 200, "Meu Café"},
		{"default-explicitly-confirmed", `{"name":"Coffe Mania"}`, "http://localhost", true, 200, "Coffe Mania"},
	} {
		t.Run(tc.label, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "http://localhost/api/coffe/cafe-name", strings.NewReader(tc.body))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Origin", tc.origin)
			if tc.cookie {
				request.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("HTTP %d: %s", response.Code, response.Body.String())
			}
			if tc.status == 200 {
				var snapshot playerstate.Snapshot
				if err := json.Unmarshal(response.Body.Bytes(), &snapshot); err != nil {
					t.Fatal(err)
				}
				if snapshot.CafeName != tc.want || !snapshot.CafeNameChosen {
					t.Fatalf("bad response: %+v", snapshot)
				}
				state, _ = app.FindFirstRecordByData(playerstate.Collection, "user", owner)
				if state.GetString("cafe_name") != tc.want || !state.GetBool("cafe_name_chosen") {
					t.Fatal("name not persisted")
				}
			}
		})
	}
	state, _ = app.FindFirstRecordByData(playerstate.Collection, "user", owner)
	if state.GetInt64("cash") != cash || state.GetInt64("gold") != gold {
		t.Fatal("renaming changed resources")
	}
	otherReloaded, _ := app.FindRecordById(playerstate.Collection, otherState.Id)
	if otherReloaded.GetString("cafe_name") != playerstate.DefaultCafeName || otherReloaded.GetBool("cafe_name_chosen") {
		t.Fatal("renaming affected another player")
	}
}
