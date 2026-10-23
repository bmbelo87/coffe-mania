package main

import (
	"testing"

	"coffe-mania/database/migrations"
	"coffe-mania/database/playerstate"
	"coffe-mania/database/starterroom"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func kitchenUnits(t *testing.T, app core.App, user string) []*core.Record {
	t.Helper()
	units, err := app.FindRecordsByFilter("player_inventory", "user={:user} && placed=true && (item_id=3070000 || item_id=3020069)", "item_id,tx,ty", 0, 0, dbx.Params{"user": user})
	if err != nil {
		t.Fatal(err)
	}
	return units
}

func assertKitchenRows(t *testing.T, app core.App, user string) {
	t.Helper()
	units := kitchenUnits(t, app, user)
	if len(units) != 6 {
		t.Fatalf("peças da cozinha: %d", len(units))
	}
	for _, expected := range starterroom.Kitchen() {
		found := false
		for _, unit := range units {
			if unit.GetInt("item_id") != expected.ItemID || unit.GetInt("tx") != expected.TX || unit.GetInt("ty") != expected.TY || unit.GetInt("rotation") != expected.Rotation {
				continue
			}
			found = true
			if id := unit.GetString("stove_id"); id != "" {
				stove, err := app.FindRecordById("player_stoves", id)
				if err != nil || stove.GetInt("tx") != expected.TX || stove.GetInt("ty") != expected.TY {
					t.Fatalf("fogão e inventário divergiram: %v", err)
				}
			}
		}
		if !found {
			t.Fatalf("posição ausente: %+v", expected)
		}
	}
	for x := 1; x <= 4; x++ {
		units, err := app.FindRecordsByFilter("player_inventory", "user={:user} && placed=true && layer='object' && tx={:x} && ty=8", "", 0, 0, dbx.Params{"user": user, "x": x})
		if err != nil || len(units) != 0 {
			t.Fatalf("corredor bloqueado em (%d,8): %v", x, err)
		}
	}
}

func legacyKitchen(t *testing.T, app core.App, user string) []*core.Record {
	t.Helper()
	units := kitchenUnits(t, app, user)
	positions := map[int][][3]int{
		3070000: {{1, 7, 3}, {3, 7, 3}, {2, 8, 1}},
		3020069: {{2, 7, 3}, {1, 8, 1}, {3, 8, 1}},
	}
	for _, unit := range units {
		unit.Set("placed", false)
		if err := app.Save(unit); err != nil {
			t.Fatal(err)
		}
	}
	for _, unit := range units {
		id := unit.GetInt("item_id")
		p := positions[id][0]
		positions[id] = positions[id][1:]
		unit.Set("tx", p[0])
		unit.Set("ty", p[1])
		unit.Set("rotation", p[2])
		unit.Set("placed", true)
		if err := app.Save(unit); err != nil {
			t.Fatal(err)
		}
		if id := unit.GetString("stove_id"); id != "" {
			stove, err := app.FindRecordById("player_stoves", id)
			if err != nil {
				t.Fatal(err)
			}
			stove.Set("tx", p[0])
			stove.Set("ty", p[1])
			if err := app.Save(stove); err != nil {
				t.Fatal(err)
			}
		}
	}
	return units
}

func TestStarterKitchenRows(t *testing.T) {
	app, user := newCookingTestApp(t)
	assertKitchenRows(t, app, user)
}

func TestKitchenRowsUpgradePreservesCooking(t *testing.T) {
	app, user := newCookingTestApp(t)
	setCookingTestLevel(t, app, user, 3)
	units := legacyKitchen(t, app, user)
	var stoveID string
	ids := map[string]bool{}
	for _, unit := range units {
		ids[unit.Id] = true
		if unit.GetString("stove_id") != "" {
			stoveID = unit.GetString("stove_id")
		}
	}
	if err := startCooking(app, user, stoveID, "passion_fruit_mousse", types.NowDateTime()); err != nil {
		t.Fatal(err)
	}
	job, err := app.FindFirstRecordByData("stove_cooking", "stove", stoveID)
	if err != nil {
		t.Fatal(err)
	}
	state, _ := app.FindFirstRecordByData(playerstate.Collection, "user", user)
	gold := state.GetInt("gold")
	room, _ := app.FindFirstRecordByData("player_rooms", "user", user)
	revision := room.GetInt("revision")
	if err := migrations.ArrangeStarterKitchens(app); err != nil {
		t.Fatal(err)
	}
	assertKitchenRows(t, app, user)
	for _, unit := range kitchenUnits(t, app, user) {
		if !ids[unit.Id] {
			t.Fatal("migração criou outra unidade")
		}
	}
	if _, err := app.FindRecordById("stove_cooking", job.Id); err != nil {
		t.Fatal("cozimento perdido", err)
	}
	state, _ = app.FindRecordById(playerstate.Collection, state.Id)
	if state.GetInt("gold") != gold {
		t.Fatal("migração alterou ouro")
	}
	room, _ = app.FindRecordById("player_rooms", room.Id)
	if room.GetInt("revision") != revision+1 {
		t.Fatal("revisão não avançou")
	}
	if err := migrations.ArrangeStarterKitchens(app); err != nil {
		t.Fatal(err)
	}
	room, _ = app.FindRecordById("player_rooms", room.Id)
	if room.GetInt("revision") != revision+1 {
		t.Fatal("migração repetida alterou o quarto")
	}
}

func TestKitchenRowsUpgradePreservesCustomizedRoom(t *testing.T) {
	for _, mode := range []string{"moved", "occupied"} {
		t.Run(mode, func(t *testing.T) {
			app, user := newCookingTestApp(t)
			units := legacyKitchen(t, app, user)
			if mode == "moved" {
				units[0].Set("rotation", (units[0].GetInt("rotation")+1)%4)
				if err := app.Save(units[0]); err != nil {
					t.Fatal(err)
				}
			} else {
				collection, _ := app.FindCollectionByNameOrId("player_inventory")
				extra := core.NewRecord(collection)
				extra.Load(map[string]any{"user": user, "item_id": 3040001, "tx": 2, "ty": 9, "rotation": 0, "placed": true, "layer": "object"})
				if err := app.Save(extra); err != nil {
					t.Fatal(err)
				}
			}
			room, _ := app.FindFirstRecordByData("player_rooms", "user", user)
			revision := room.GetInt("revision")
			if err := migrations.ArrangeStarterKitchens(app); err != nil {
				t.Fatal(err)
			}
			for _, before := range units {
				after, _ := app.FindRecordById("player_inventory", before.Id)
				for _, field := range []string{"tx", "ty", "rotation"} {
					if after.GetInt(field) != before.GetInt(field) {
						t.Fatalf("alterou peça personalizada: %s", field)
					}
				}
			}
			room, _ = app.FindRecordById("player_rooms", room.Id)
			if room.GetInt("revision") != revision {
				t.Fatal("quarto personalizado recebeu alteração")
			}
		})
	}
}
