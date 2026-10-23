package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"coffe-mania/database/playerstate"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func notificationState(t *testing.T, app core.App, userID string) *core.Record {
	t.Helper()
	row, err := app.FindFirstRecordByData(playerstate.Collection, "user", userID)
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func TestLevelAcknowledgementRouteOwnerOriginAndRetry(t *testing.T) {
	app, userID := newCookingTestApp(t)
	state := notificationState(t, app, userID)
	playerstate.GrantExperience(state, 95)
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	gold := state.GetInt64("gold")
	user, err := app.FindRecordById("users", userID)
	if err != nil {
		t.Fatal(err)
	}
	token, err := user.NewAuthToken()
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
		name, origin, body string
		cookie             bool
		status             int
	}{
		{"anonymous", "http://localhost", `{"level":3}`, false, 401},
		{"foreign-origin", "https://elsewhere.invalid", `{"level":3}`, true, 403},
		{"invalid-level", "http://localhost", `{"level":1}`, true, 400},
		{"success", "http://localhost", `{"level":3}`, true, 204},
		{"retry", "http://localhost", `{"level":3}`, true, 204},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "http://localhost/api/coffe/level-ups/ack", strings.NewReader(tc.body))
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
		})
	}
	state = notificationState(t, app, userID)
	rewards := playerstate.PendingLevelRewards(state)
	if len(rewards) != 2 || rewards[0].Level != 2 || rewards[1].Level != 4 || state.GetInt64("gold") != gold {
		t.Fatalf("confirmação modificou recursos ou outros recibos: %+v", rewards)
	}
}

func TestLevelNotificationsPersistAndAcknowledgementNeverPaysAgain(t *testing.T) {
	app, userID := newCookingTestApp(t)
	state := notificationState(t, app, userID)
	gold := state.GetInt64("gold")
	if gained := playerstate.GrantExperience(state, 95); gained != 3 {
		t.Fatalf("níveis ganhos: %d", gained)
	}
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	state = notificationState(t, app, userID)
	rewards := playerstate.View(state).LevelUps
	if len(rewards) != 3 || rewards[0].Level != 2 || rewards[1].Level != 3 || rewards[2].Level != 4 {
		t.Fatalf("fila persistida: %+v", rewards)
	}
	if rewards[0].Gold != 700 || len(rewards[1].Recipes) != 2 {
		t.Fatalf("recompensas: %+v", rewards)
	}
	for range 2 {
		playerstate.AcknowledgeLevel(state, 3)
		if err := app.Save(state); err != nil {
			t.Fatal(err)
		}
		state = notificationState(t, app, userID)
	}
	rewards = playerstate.View(state).LevelUps
	if len(rewards) != 2 || rewards[0].Level != 2 || rewards[1].Level != 4 {
		t.Fatalf("confirmação apagou outro nível: %+v", rewards)
	}
	if state.GetInt64("gold") != gold+2100 {
		t.Fatal("confirmar o popup alterou o ouro")
	}
	playerstate.GrantExperience(state, 1)
	if len(playerstate.View(state).LevelUps) != 2 {
		t.Fatal("XP sem mudança de nível repetiu o aviso")
	}
}

func TestLevelRewardWaiterUnlockAndTrustedAdjustments(t *testing.T) {
	app, userID := newCookingTestApp(t)
	state := notificationState(t, app, userID)
	gold := state.GetInt64("gold")
	playerstate.SetLevel(state, 6)
	if len(playerstate.View(state).LevelUps) != 0 || state.GetInt64("gold") != gold {
		t.Fatal("ajuste administrativo gerou prêmio")
	}
	playerstate.GrantExperience(state, playerstate.RequiredXP(7)-playerstate.RequiredXP(6))
	rewards := playerstate.View(state).LevelUps
	if len(rewards) != 1 || rewards[0].Level != 7 || rewards[0].Waiters != 1 || rewards[0].WaiterSlots != 2 {
		t.Fatalf("liberação de vaga: %+v", rewards)
	}
	if playerstate.RewardForLevel(80).Gold != 20000 || playerstate.RewardForLevel(80).Title != "Mestre do Churrasco" {
		t.Fatal("referência do popup divergente")
	}
}
