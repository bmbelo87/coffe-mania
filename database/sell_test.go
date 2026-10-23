package main

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func sellCommand(t *testing.T, app core.App, userID, unitID string) roomCommand {
	t.Helper()
	room, err := app.FindFirstRecordByData("player_rooms", "user", userID)
	if err != nil {
		t.Fatal(err)
	}
	revision := room.GetInt("revision")
	return roomCommand{UnitID: unitID, Revision: &revision, RequestID: uuid.NewString()}
}

func TestSellPaysThirtyPercentAndRemovesTheUnit(t *testing.T) {
	app, userID := newCookingTestApp(t)
	state := playerState(t, app, userID)
	state.Set("gold", 1000)
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	room, _ := app.FindFirstRecordByData("player_rooms", "user", userID)
	revision := room.GetInt("revision")
	x, y, rotation := 6, 6, 0
	bought, err := mutateRoom(app, userID, "purchase", roomCommand{ItemID: 3030010, TX: &x, TY: &y, Rotation: &rotation, Revision: &revision, RequestID: uuid.NewString()})
	if err != nil {
		t.Fatal(err)
	}
	var unitID string
	for _, unit := range bought.Inventory {
		if unit.ItemID == 3030010 {
			unitID = unit.UnitID
		}
	}
	if unitID == "" || bought.PlayerState.Gold != 500 || bought.SellPercent != 30 {
		t.Fatalf("compra: unidade %q, ouro %d, venda %d%%", unitID, bought.PlayerState.Gold, bought.SellPercent)
	}
	sold, err := mutateRoom(app, userID, "sell", sellCommand(t, app, userID, unitID))
	if err != nil {
		t.Fatal(err)
	}
	if sold.PlayerState.Gold != 650 {
		t.Fatalf("mesa de 500 ouros vendida por 30%%: ouro %d, esperado 650", sold.PlayerState.Gold)
	}
	for _, unit := range sold.Inventory {
		if unit.UnitID == unitID {
			t.Fatal("a unidade vendida some do inventário")
		}
	}
	if _, err := app.FindRecordById("player_inventory", unitID); err == nil {
		t.Fatal("a unidade vendida deve ser apagada do banco")
	}
}

func TestSellRefusesBusyAndWorthlessItems(t *testing.T) {
	app, userID := newCookingTestApp(t)
	setCookingTestLevel(t, app, userID, 3)
	stove, err := app.FindFirstRecordByData("player_stoves", "user", userID)
	if err != nil {
		t.Fatal(err)
	}
	unit, err := app.FindFirstRecordByData("player_inventory", "stove_id", stove.Id)
	if err != nil {
		t.Fatal(err)
	}
	if err := startCooking(app, userID, stove.Id, "passion_fruit_mousse", types.NowDateTime()); err != nil {
		t.Fatal(err)
	}
	if _, err := mutateRoom(app, userID, "sell", sellCommand(t, app, userID, unit.Id)); !errors.Is(err, errRoomBusy) {
		t.Fatalf("fogão com prato não pode ser vendido: %v", err)
	}
	floors, err := app.FindRecordsByFilter("player_inventory", "user={:user} && layer='floor'", "", 1, 0, dbx.Params{"user": userID})
	if err != nil || len(floors) == 0 {
		t.Skip("conta sem piso inicial")
	}
	if _, err := mutateRoom(app, userID, "sell", sellCommand(t, app, userID, floors[0].Id)); !errors.Is(err, errRoomNotSellable) {
		t.Fatalf("piso de 1 ouro não rende nada e não é vendido: %v", err)
	}
}
