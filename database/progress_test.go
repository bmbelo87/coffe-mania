package main

import (
	"bytes"
	"testing"

	"coffe-mania/database/playerstate"

	"github.com/google/uuid"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func playerState(t *testing.T, app core.App, userID string) *core.Record {
	t.Helper()
	state, err := app.FindFirstRecordByData(playerstate.Collection, "user", userID)
	if err != nil {
		t.Fatal(err)
	}
	return state
}

func TestLevelCurveFollowsGameConfig(t *testing.T) {
	if playerstate.MaxLevel() != 260 || playerstate.RequiredXP(2) != 7 || playerstate.RequiredXP(60) != 122130 {
		t.Fatalf("curva: máx %d, nível 2 %d, nível 60 %d", playerstate.MaxLevel(), playerstate.RequiredXP(2), playerstate.RequiredXP(60))
	}
	for total, level := range map[int64]int{0: 1, 6: 1, 7: 2, 39: 2, 40: 3, 7353540: 260, 9999999: 260} {
		if got := playerstate.LevelFor(total); got != level {
			t.Fatalf("LevelFor(%d) = %d, esperado %d", total, got, level)
		}
	}
}

func TestExperienceLevelsUpAndPaysEachLevel(t *testing.T) {
	app, userID := newCookingTestApp(t)
	state := playerState(t, app, userID)
	if state.GetInt("level") != 1 || state.GetInt64("experience_current") != 0 || state.GetInt64("experience_max") != 7 {
		t.Fatalf("jogador novo: nível %d, XP %d/%d", state.GetInt("level"), state.GetInt64("experience_current"), state.GetInt64("experience_max"))
	}
	gold := state.GetInt64("gold")
	// 0 → 95 XP crosses levels 2, 3 and 4 (7, 40, 95), each paying 700 caféOuros.
	if gained := playerstate.GrantExperience(state, 95); gained != 3 {
		t.Fatalf("níveis ganhos: %d", gained)
	}
	if state.GetInt("level") != 4 || state.GetInt64("experience_max") != 165 || state.GetInt64("gold") != gold+2100 {
		t.Fatalf("depois de 95 XP: nível %d, próximo %d, ouro %d", state.GetInt("level"), state.GetInt64("experience_max"), state.GetInt64("gold")-gold)
	}
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	playerstate.SetLevel(state, 260)
	playerstate.GrantExperience(state, 1000)
	if state.GetInt64("experience_current") != playerstate.RequiredXP(260) || state.GetInt64("experience_current") > state.GetInt64("experience_max") {
		t.Fatalf("no nível máximo o XP para: %d/%d", state.GetInt64("experience_current"), state.GetInt64("experience_max"))
	}
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
}

func TestDishPaysItsBookXPAcrossPortionsAndPopularity(t *testing.T) {
	app, userID := newCookingTestApp(t)
	stove, err := app.FindFirstRecordByData("player_stoves", "user", userID)
	if err != nil {
		t.Fatal(err)
	}
	state := playerState(t, app, userID)
	playerstate.SetExperience(state, 80)
	playerstate.SetPopularity(state, 1045)
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	if err := startCooking(app, userID, stove.Id, "passion_fruit_mousse", types.NowDateTime()); err != nil {
		t.Fatal(err)
	}
	if xp := playerState(t, app, userID).GetInt64("experience_current"); xp != 80 {
		t.Fatalf("iniciar o preparo não dá XP: %d", xp)
	}
	finishJob(t, app, stove.Id)
	if err := serveCooking(app, userID, stove.Id, types.NowDateTime()); err != nil {
		t.Fatal(err)
	}
	foods, err := app.FindRecordsByFilter("room_food", "user={:user}", "", 0, 0, dbx.Params{"user": userID})
	if err != nil || len(foods) != 1 || foods[0].GetInt64("experience") != 30 {
		t.Fatalf("o prato leva o XP do livro ao balcão: %v %v", foods, err)
	}
	before := playerState(t, app, userID)
	gold := before.GetInt64("gold")
	for portion := 0; portion < 22; portion++ {
		if err := app.RunInTransaction(func(tx core.App) error { return consumePortion(tx, userID, foods[0].Id) }); err != nil {
			t.Fatal(err)
		}
		if portion == 0 && playerState(t, app, userID).GetInt64("experience_current") != 82 {
			t.Fatal("a primeira porção comida já dá XP")
		}
	}
	after := playerState(t, app, userID)
	// 80 + 30 XP crosses level 4 at 95 XP; each portion pays 12 caféOuros.
	if after.GetInt64("experience_current") != 110 || after.GetInt("level") != 4 || after.GetInt64("gold") != gold+22*12+700 {
		t.Fatalf("após 22 porções: XP %d, nível %d, ouro +%d", after.GetInt64("experience_current"), after.GetInt("level"), after.GetInt64("gold")-gold)
	}
	if after.GetInt64("satisfaction_current_tenths") != playerstate.MaxPopularityTenths {
		t.Fatalf("a popularidade para em 105: %d", after.GetInt64("satisfaction_current_tenths"))
	}
	playerstate.AdjustPopularity(after, -10000)
	if after.GetInt64("satisfaction_current_tenths") != playerstate.MinPopularityTenths {
		t.Fatalf("a popularidade não desce de 5: %d", after.GetInt64("satisfaction_current_tenths"))
	}
}

func TestDevAddFoodCarriesProportionalXP(t *testing.T) {
	t.Setenv("COFFE_DEV_TOOLS", "true")
	app, userID := newCookingTestApp(t)
	body := []byte(`{"requestId":"` + uuid.NewString() + `","command":"add_food","recipeId":"passion_fruit_mousse","value":11}`)
	command, err := decodeDevCommand(bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	for range 2 { // A retried receipt must not place the dish twice.
		if err := mutateDev(app, userID, command); err != nil {
			t.Fatal(err)
		}
	}
	foods, err := app.FindRecordsByFilter("room_food", "user={:user}", "", 0, 0, dbx.Params{"user": userID})
	if err != nil || len(foods) != 1 || foods[0].GetInt("portions") != 11 || foods[0].GetInt64("experience") != 15 {
		t.Fatalf("prato do modo dev: %v %v", foods, err)
	}
	if _, err := decodeDevCommand(bytes.NewReader([]byte(`{"requestId":"` + uuid.NewString() + `","command":"spawn_customers","value":11}`))); err == nil {
		t.Fatal("o modo dev limita os clientes chamados de uma vez")
	}
	// Customer commands only leave a receipt; the room service carries them out.
	spawn, err := decodeDevCommand(bytes.NewReader([]byte(`{"requestId":"` + uuid.NewString() + `","command":"spawn_customers","value":2}`)))
	if err != nil {
		t.Fatal(err)
	}
	if err := mutateDev(app, userID, spawn); err != nil {
		t.Fatalf("comando de clientes recusado pela persistência: %v", err)
	}
}

func TestLevelFieldAllowsEveryLevelOfTheTable(t *testing.T) {
	app, userID := newCookingTestApp(t)
	state := playerState(t, app, userID)
	playerstate.SetLevel(state, playerstate.MaxLevel())
	if err := app.Save(state); err != nil {
		t.Fatalf("o campo level precisa aceitar o nível %d: %v", playerstate.MaxLevel(), err)
	}
}
