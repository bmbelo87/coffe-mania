package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"coffe-mania/database/playerstate"
	"github.com/google/uuid"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func TestSpicePurchaseRouteRequiresCookieAndSameOrigin(t *testing.T) {
	app, user := newCookingTestApp(t)
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	registerSpicePurchaseRoutes(&core.ServeEvent{App: app, Router: router})
	handler, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	record, err := app.FindRecordById("users", user)
	if err != nil {
		t.Fatal(err)
	}
	token, err := record.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	key := uuid.NewString()
	for _, tc := range []struct {
		name, origin, body string
		cookie             bool
		status             int
	}{
		{"anonymous", "http://localhost", `{"spice":"salt","requestId":"` + key + `"}`, false, 401},
		{"no-origin", "", `{"spice":"salt","requestId":"` + key + `"}`, true, 403},
		{"foreign-origin", "https://elsewhere.invalid", `{"spice":"salt","requestId":"` + key + `"}`, true, 403},
		{"unknown-field", "http://localhost", `{"spice":"salt","requestId":"` + key + `","user":"someone"}`, true, 400},
		{"extra-json", "http://localhost", `{"spice":"salt","requestId":"` + key + `"}{}`, true, 400},
		{"invalid-key", "http://localhost", `{"spice":"salt","requestId":"bad"}`, true, 400},
		{"success", "http://localhost", `{"spice":"salt","requestId":"` + key + `"}`, true, 200},
		{"retry", "http://localhost", `{"spice":"salt","requestId":"` + key + `"}`, true, 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "http://localhost/api/coffe/cooking/spices/purchase", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", tc.origin)
			if tc.cookie {
				req.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
			}
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			if res.Code != tc.status {
				t.Fatalf("HTTP %d: %s", res.Code, res.Body.String())
			}
			if res.Code == 200 {
				var state playerstate.Snapshot
				if err := json.Unmarshal(res.Body.Bytes(), &state); err != nil {
					t.Fatal(err)
				}
				if state.SpiceInventory["salt"] != 1 {
					t.Fatal("estoque da resposta")
				}
			}
		})
	}
}

func TestSpiceConcurrentPurchaseRetryChargesOnce(t *testing.T) {
	app, user := newCookingTestApp(t)
	before := spiceTestState(t, app, user).GetInt64("cash")
	var wg sync.WaitGroup
	failures := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); failures <- purchaseSpice(app, user, "thyme", "same-key") }()
	}
	wg.Wait()
	close(failures)
	for err := range failures {
		if err != nil {
			t.Fatal(err)
		}
	}
	state := playerstate.View(spiceTestState(t, app, user))
	if state.Cash != before-1 || state.SpiceInventory["thyme"] != 1 {
		t.Fatalf("compra concorrente duplicada: %+v", state)
	}
}

func TestSpiceUltraAndInstantConsumeExactlyOneUnit(t *testing.T) {
	for _, id := range []string{"thyme_ultra", "instant"} {
		t.Run(id, func(t *testing.T) {
			app, user := newCookingTestApp(t)
			stove, err := app.FindFirstRecordByData("player_stoves", "user", user)
			if err != nil {
				t.Fatal(err)
			}
			state := spiceTestState(t, app, user)
			state.Set("gold", 10000)
			if err := app.Save(state); err != nil {
				t.Fatal(err)
			}
			now := types.NowDateTime()
			if err := startCooking(app, user, stove.Id, "churrasco", now); err != nil {
				t.Fatal(err)
			}
			if err := purchaseSpice(app, user, id, "buy"); err != nil {
				t.Fatal(err)
			}
			job, err := app.FindFirstRecordByData("stove_cooking", "stove", stove.Id)
			if err != nil {
				t.Fatal(err)
			}
			before := job.GetDateTime("ready_at")
			if err := spiceDish(app, user, stove.Id, id, now); err != nil {
				t.Fatal(err)
			}
			job, err = app.FindFirstRecordByData("stove_cooking", "stove", stove.Id)
			if err != nil {
				t.Fatal(err)
			}
			if id == "thyme_ultra" && before.Time().Sub(job.GetDateTime("ready_at").Time()) != 6*time.Hour {
				t.Fatal("ultra não tirou 6 horas")
			}
			if id == "instant" && job.GetDateTime("ready_at").After(now) {
				t.Fatal("instantâneo não ficou pronto")
			}
			if playerstate.View(spiceTestState(t, app, user)).SpiceInventory[id] != 0 {
				t.Fatal("estoque não consumido")
			}
		})
	}
}

func spiceTestState(t *testing.T, app core.App, user string) *core.Record {
	t.Helper()
	state, err := app.FindFirstRecordByData(playerstate.Collection, "user", user)
	if err != nil {
		t.Fatal(err)
	}
	return state
}

func TestSpicePurchasesAreIdempotentAndPrivate(t *testing.T) {
	app, user := newCookingTestApp(t)
	before := spiceTestState(t, app, user).GetInt64("cash")
	for i := 0; i < 2; i++ {
		if err := purchaseSpice(app, user, "pepper", "one-purchase"); err != nil {
			t.Fatal(err)
		}
	}
	state := spiceTestState(t, app, user)
	view := playerstate.View(state)
	if view.Cash != before-2 || view.SpiceInventory["pepper"] != 1 {
		t.Fatalf("compra duplicada: %+v", view)
	}
	if err := purchaseSpice(app, user, "salt", "one-purchase"); !errors.Is(err, errSpicePurchaseConflict) {
		t.Fatalf("reuso de chave: %v", err)
	}
	// Releitura dos dados duráveis; o snapshot privado não depende do runtime.
	state = spiceTestState(t, app, user)
	if playerstate.View(state).SpiceInventory["pepper"] != 1 {
		t.Fatal("estoque não persistiu")
	}
	snapshot, err := snapshotCooking(app, user, types.NowDateTime())
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Spices) != 6 {
		t.Fatalf("catálogo precisa de seis temperos: %d", len(snapshot.Spices))
	}
	c, err := app.FindCollectionByNameOrId("spice_purchases")
	if err != nil {
		t.Fatal(err)
	}
	if c.CreateRule != nil || c.UpdateRule != nil || c.ListRule != nil {
		t.Fatal("recibos devem ser privados")
	}
	stock, err := spiceInventory(state)
	if err != nil {
		t.Fatal(err)
	}
	stock["pepper"] = maxSpiceStock
	state.Set("spice_inventory", stock)
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	if err := purchaseSpice(app, user, "pepper", "stock-limit"); !errors.Is(err, errSpiceStockLimit) {
		t.Fatalf("limite de estoque: %v", err)
	}
}

func TestSpicePortionsConsumeStockAndPersistBonus(t *testing.T) {
	for _, tc := range []struct {
		id             string
		percent, price int64
	}{{"salt", 6, 1}, {"pepper", 12, 2}} {
		t.Run(tc.id, func(t *testing.T) {
			app, user := newCookingTestApp(t)
			setCookingTestLevel(t, app, user, 3)
			stove, err := app.FindFirstRecordByData("player_stoves", "user", user)
			if err != nil {
				t.Fatal(err)
			}
			now := types.NowDateTime()
			if err := startCooking(app, user, stove.Id, "passion_fruit_mousse", now); err != nil {
				t.Fatal(err)
			}
			if err := spiceDish(app, user, stove.Id, tc.id, now); !errors.Is(err, errNoSpice) {
				t.Fatalf("estoque vazio: %v", err)
			}
			cash := spiceTestState(t, app, user).GetInt64("cash")
			if err := purchaseSpice(app, user, tc.id, "buy"); err != nil {
				t.Fatal(err)
			}
			if err := spiceDish(app, user, "foreign-stove", tc.id, now); !errors.Is(err, errStoveNotOwned) {
				t.Fatalf("posse: %v", err)
			}
			if playerstate.View(spiceTestState(t, app, user)).SpiceInventory[tc.id] != 1 {
				t.Fatal("recusa consumiu estoque")
			}
			if err := spiceDish(app, user, stove.Id, tc.id, now); err != nil {
				t.Fatal(err)
			}
			state := playerstate.View(spiceTestState(t, app, user))
			if state.SpiceInventory[tc.id] != 0 || state.Cash != cash-tc.price {
				t.Fatalf("uso cobrou de novo: %+v", state)
			}
			if err := spiceDish(app, user, stove.Id, tc.id, now); !errors.Is(err, errAlreadySpiced) {
				t.Fatalf("aplicação repetida: %v", err)
			}
			job, err := app.FindFirstRecordByData("stove_cooking", "stove", stove.Id)
			if err != nil {
				t.Fatal(err)
			}
			if job.GetInt64("bonus_portions") != 22*tc.percent/100 {
				t.Fatal("bônus não persistiu")
			}
			finishJob(t, app, stove.Id)
			if err := serveCooking(app, user, stove.Id, types.NowDateTime()); err != nil {
				t.Fatal(err)
			}
			food, err := app.FindFirstRecordByData("room_food", "user", user)
			if err != nil {
				t.Fatal(err)
			}
			if food.GetInt64("portions") != 22+22*tc.percent/100 {
				t.Fatalf("porções: %d", food.GetInt64("portions"))
			}
		})
	}
}
