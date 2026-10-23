package main

import (
	"errors"
	"testing"

	"coffe-mania/shared/roomcatalog"
	"github.com/google/uuid"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

func expandCommand(t *testing.T, app core.App, userID, payment string) roomCommand {
	t.Helper()
	command := sellCommand(t, app, userID, "")
	command.Payment = payment
	return command
}

func setWallet(t *testing.T, app core.App, userID string, level int, cash, gold int64) {
	t.Helper()
	state := playerState(t, app, userID)
	state.Set("level", level)
	state.Set("cash", cash)
	state.Set("gold", gold)
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
}

type shellTile struct{ x, y int }

func roomShell(t *testing.T, app core.App, userID string) (walls, papers, floors map[shellTile]int) {
	t.Helper()
	units, err := app.FindRecordsByFilter("player_inventory", "user={:user} && placed=true", "", 0, 0, dbx.Params{"user": userID})
	if err != nil {
		t.Fatal(err)
	}
	walls, papers, floors = map[shellTile]int{}, map[shellTile]int{}, map[shellTile]int{}
	for _, unit := range units {
		at := shellTile{unit.GetInt("tx"), unit.GetInt("ty")}
		switch unit.GetString("layer") {
		case "structure":
			walls[at] = unit.GetInt("item_id")
		case "wallpaper":
			papers[at] = unit.GetInt("item_id")
		case "floor":
			floors[at] = unit.GetInt("item_id")
		}
	}
	return walls, papers, floors
}

func TestExpansionWithCashAddsTheBlockWithWallsAndStarterFloor(t *testing.T) {
	app, userID := newCookingTestApp(t)
	first := expansionSteps[0]
	setWallet(t, app, userID, 1, first.PriceCash+3, 0)
	command := expandCommand(t, app, userID, "cash")
	snapshot, err := mutateExpansion(app, userID, command)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.TilesX != first.FloorX+1 || snapshot.TilesY != first.FloorY+1 || snapshot.PlayerState.Cash != 3 {
		t.Fatalf("sala %dx%d, granas %d", snapshot.TilesX, snapshot.TilesY, snapshot.PlayerState.Cash)
	}
	if snapshot.Expansion == nil || snapshot.Expansion.Step != 2 || snapshot.Expansion.FloorX != expansionSteps[1].FloorX {
		t.Fatalf("próxima oferta: %+v", snapshot.Expansion)
	}
	walls, papers, floors := roomShell(t, app, userID)
	for y := 1; y < snapshot.TilesY; y++ {
		if walls[shellTile{0, y}] != roomWallItemID || papers[shellTile{0, y}] == 0 {
			t.Fatalf("parede esquerda sem parede ou papel no tile 0,%d", y)
		}
	}
	for x := 1; x < snapshot.TilesX; x++ {
		if walls[shellTile{x, 0}] != roomWallItemID || papers[shellTile{x, 0}] == 0 {
			t.Fatalf("parede direita sem parede ou papel no tile %d,0", x)
		}
	}
	for y := 1; y < snapshot.TilesY; y++ {
		for x := 1; x < snapshot.TilesX; x++ {
			if floors[shellTile{x, y}] == 0 {
				t.Fatalf("tile %d,%d sem piso", x, y)
			}
		}
	}
	if floors[shellTile{1, snapshot.TilesY - 1}] != starterFloorItemID {
		t.Fatal("o bloco novo recebe o piso inicial")
	}
	// Repeating the request key returns the stored result without charging again.
	again, err := mutateExpansion(app, userID, command)
	if err != nil || again.PlayerState.Cash != 3 || again.TilesY != first.FloorY+1 {
		t.Fatalf("repetição: %v, granas %d, sala %d", err, again.PlayerState.Cash, again.TilesY)
	}
}

func TestExpansionWithGoldNeedsTheLevelOrTheUnlock(t *testing.T) {
	app, userID := newCookingTestApp(t)
	first := expansionSteps[0]
	setWallet(t, app, userID, first.Level-1, first.UnlockCash, first.PriceGold)
	if _, err := mutateExpansion(app, userID, expandCommand(t, app, userID, "gold")); !errors.Is(err, errExpansionLevel) {
		t.Fatalf("nível baixo: %v", err)
	}
	snapshot, err := mutateExpansion(app, userID, expandCommand(t, app, userID, "gold_unlock"))
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.PlayerState.Cash != 0 || snapshot.PlayerState.Gold != 0 || snapshot.TilesY != first.FloorY+1 {
		t.Fatalf("desbloqueio: granas %d, ouro %d, sala %d", snapshot.PlayerState.Cash, snapshot.PlayerState.Gold, snapshot.TilesY)
	}
}

func TestExpansionRefusesMissingMoneyAndStaleRevisions(t *testing.T) {
	app, userID := newCookingTestApp(t)
	first := expansionSteps[0]
	setWallet(t, app, userID, first.Level, first.PriceCash-1, first.PriceGold-1)
	if _, err := mutateExpansion(app, userID, expandCommand(t, app, userID, "cash")); !errors.Is(err, errExpansionCash) {
		t.Fatalf("granas insuficientes: %v", err)
	}
	if _, err := mutateExpansion(app, userID, expandCommand(t, app, userID, "gold")); !errors.Is(err, errRoomGold) {
		t.Fatalf("ouro insuficiente: %v", err)
	}
	if _, err := mutateExpansion(app, userID, expandCommand(t, app, userID, "")); !errors.Is(err, errExpansionPayment) {
		t.Fatalf("sem forma de pagamento: %v", err)
	}
	stale := 9999
	if _, err := mutateExpansion(app, userID, roomCommand{Revision: &stale, RequestID: uuid.NewString(), Payment: "cash"}); !errors.Is(err, errRoomConflict) {
		t.Fatalf("revisão antiga: %v", err)
	}
	room, _ := app.FindFirstRecordByData("player_rooms", "user", userID)
	if room.GetInt("tiles_x") != starterFloorX+1 || room.GetInt("tiles_y") != starterFloorY+1 {
		t.Fatalf("pedidos recusados não alteram a sala: %dx%d", room.GetInt("tiles_x"), room.GetInt("tiles_y"))
	}
}

func TestRepairFillsRoomsExpandedWithoutShell(t *testing.T) {
	app, userID := newCookingTestApp(t)
	room, _ := app.FindFirstRecordByData("player_rooms", "user", userID)
	room.Set("tiles_x", 10)
	room.Set("tiles_y", 13)
	if err := app.Save(room); err != nil {
		t.Fatal(err)
	}
	// The custom wallpaper of the last segment continues on the new ones.
	papers, err := app.FindRecordsByFilter("player_inventory", "user={:user} && layer='wallpaper' && tx=0 && ty={:y}", "", 1, 0, dbx.Params{"user": userID, "y": starterFloorY})
	if err != nil || len(papers) != 1 {
		t.Fatalf("papel de parede inicial: %v", err)
	}
	const custom = 9000002
	papers[0].Set("item_id", custom)
	if err := app.Save(papers[0]); err != nil {
		t.Fatal(err)
	}
	if err := repairRoomShell(app, userID); err != nil {
		t.Fatal(err)
	}
	walls, wallpapers, floors := roomShell(t, app, userID)
	if walls[shellTile{0, 12}] != roomWallItemID || walls[shellTile{9, 0}] != roomWallItemID || floors[shellTile{9, 12}] != starterFloorItemID {
		t.Fatal("paredes e piso do trecho novo")
	}
	if wallpapers[shellTile{0, 10}] != custom || wallpapers[shellTile{0, 12}] != custom {
		t.Fatalf("papel continuado: %d %d", wallpapers[shellTile{0, 10}], wallpapers[shellTile{0, 12}])
	}
	revision := room.GetInt("revision")
	if err := repairRoomShell(app, userID); err != nil {
		t.Fatal(err)
	}
	room, _ = app.FindFirstRecordByData("player_rooms", "user", userID)
	if room.GetInt("revision") != revision+1 {
		t.Fatalf("um reparo sem nada a fazer não muda a revisão: %d → %d", revision, room.GetInt("revision"))
	}
}

func TestNewCafeStartsWithASixByNineFloorAndEveryPieceInside(t *testing.T) {
	app, userID := newCookingTestApp(t)
	room, _ := app.FindFirstRecordByData("player_rooms", "user", userID)
	if room.GetInt("tiles_x") != 7 || room.GetInt("tiles_y") != 10 {
		t.Fatalf("café inicial %dx%d, esperado piso 6x9", room.GetInt("tiles_x")-1, room.GetInt("tiles_y")-1)
	}
	units, err := app.FindRecordsByFilter("player_inventory", "user={:user} && placed=true", "", 0, 0, dbx.Params{"user": userID})
	if err != nil {
		t.Fatal(err)
	}
	for _, unit := range units {
		if x, y := unit.GetInt("tx"), unit.GetInt("ty"); x > starterFloorX || y > starterFloorY {
			t.Fatalf("item %d fora do café inicial em %d,%d", unit.GetInt("item_id"), x, y)
		}
	}
	if offer := expansionFor(room.GetInt("tiles_x"), room.GetInt("tiles_y")); offer == nil || offer.FloorX != 7 || offer.FloorY != 9 || offer.PriceCash != 5 {
		t.Fatalf("primeira expansão: %+v", offer)
	}
}

func TestDevResetStartsTheSaveOver(t *testing.T) {
	app, userID := newCookingTestApp(t)
	setWallet(t, app, userID, 1, 50, 0)
	if _, err := mutateExpansion(app, userID, expandCommand(t, app, userID, "cash")); err != nil {
		t.Fatal(err)
	}
	if err := app.RunInTransaction(func(tx core.App) error { return resetDevCafe(tx, userID) }); err != nil {
		t.Fatal(err)
	}
	room, _ := app.FindFirstRecordByData("player_rooms", "user", userID)
	stoves, _ := app.FindRecordsByFilter("player_stoves", "user={:user}", "", 0, 0, dbx.Params{"user": userID})
	if room.GetInt("tiles_x") != starterFloorX+1 || room.GetInt("tiles_y") != starterFloorY+1 || len(stoves) != 3 {
		t.Fatalf("café recriado %dx%d com %d fogões", room.GetInt("tiles_x"), room.GetInt("tiles_y"), len(stoves))
	}
	state := playerState(t, app, userID)
	if state.GetInt64("cash") != 1000 || state.GetInt("level") != 1 || state.GetInt64("experience_current") != 0 {
		t.Fatalf("o save recomeça como conta nova: granas %d, nível %d", state.GetInt64("cash"), state.GetInt("level"))
	}
}

func TestPatioIsBoughtInFixedLotsNoLargerThanTheCafe(t *testing.T) {
	app, userID := newCookingTestApp(t)
	setWallet(t, app, userID, 1, 1000, 1000000)
	first, err := mutatePatio(app, userID, expandCommand(t, app, userID, "cash"))
	if err != nil {
		t.Fatal(err)
	}
	if first.PatioX != 4 || first.PatioY != 4 || first.PlayerState.Cash != 1000-patioSteps[0].PriceCash {
		t.Fatalf("primeiro terreno %dx%d, granas %d", first.PatioX, first.PatioY, first.PlayerState.Cash)
	}
	_, _, floors := roomShell(t, app, userID)
	cafeY := starterFloorY + 1
	if floors[shellTile{1, cafeY}] != patioFloorItemID || floors[shellTile{4, cafeY + 3}] != patioFloorItemID || floors[shellTile{5, cafeY}] != 0 {
		t.Fatal("o pátio 4x4 recebe grama só nos seus tiles")
	}
	if first.Patio == nil || first.Patio.FloorX != 7 || first.Patio.FloorY != 6 {
		t.Fatalf("próximo terreno: %+v", first.Patio)
	}
	// 7x6 is wider than the 6x9 café: the café must grow first.
	if _, err := mutatePatio(app, userID, expandCommand(t, app, userID, "cash")); !errors.Is(err, errPatioCafe) {
		t.Fatalf("pátio maior que o café: %v", err)
	}
	if _, err := mutateExpansion(app, userID, expandCommand(t, app, userID, "cash")); err != nil {
		t.Fatal(err)
	}
	second, err := mutatePatio(app, userID, expandCommand(t, app, userID, "cash"))
	if err != nil || second.PatioX != 7 || second.PatioY != 6 || second.Patio != nil {
		t.Fatalf("segundo terreno: %v, %dx%d, oferta %+v", err, second.PatioX, second.PatioY, second.Patio)
	}
	if _, err := mutatePatio(app, userID, expandCommand(t, app, userID, "cash")); !errors.Is(err, errPatioMax) {
		t.Fatalf("depois do último terreno: %v", err)
	}
}

func TestPatioPiecesFollowTheCafeWhenItGainsRows(t *testing.T) {
	app, userID := newCookingTestApp(t)
	setWallet(t, app, userID, 1, 1000, 1000000)
	if _, err := mutatePatio(app, userID, expandCommand(t, app, userID, "cash")); err != nil {
		t.Fatal(err)
	}
	cafeY := starterFloorY + 1
	room, _ := app.FindFirstRecordByData("player_rooms", "user", userID)
	revision, x, y, rotation := room.GetInt("revision"), 2, cafeY+1, 0
	bought, err := mutateRoom(app, userID, "purchase", roomCommand{ItemID: 3030010, TX: &x, TY: &y, Rotation: &rotation, Revision: &revision, RequestID: uuid.NewString()})
	if err != nil {
		t.Fatalf("mesa no pátio: %v", err)
	}
	var tableID string
	for _, unit := range bought.Inventory {
		if unit.ItemID == 3030010 && unit.TY == y {
			tableID = unit.UnitID
		}
	}
	if _, err := mutateExpansion(app, userID, expandCommand(t, app, userID, "cash")); err != nil { // 7x9: no new row
		t.Fatal(err)
	}
	grown, err := mutateExpansion(app, userID, expandCommand(t, app, userID, "cash")) // 8x10: one more row
	if err != nil {
		t.Fatal(err)
	}
	table, _ := app.FindRecordById("player_inventory", tableID)
	if grown.TilesY != cafeY+1 || table.GetInt("ty") != y+1 {
		t.Fatalf("café com %d linhas, mesa em y=%d", grown.TilesY, table.GetInt("ty"))
	}
	_, _, floors := roomShell(t, app, userID)
	if floors[shellTile{2, cafeY}] != starterFloorItemID || floors[shellTile{2, cafeY + 1}] != patioFloorItemID {
		t.Fatal("a linha nova é do café e o pátio desce junto")
	}
}

func TestPositionsFollowTheCafeAndPatioShape(t *testing.T) {
	area := roomArea{TilesX: 7, TilesY: 10, PatioX: 4, PatioY: 4}
	table, _ := roomcatalog.ByID(3030010)
	window, _ := roomcatalog.ByID(3000011)
	cases := []struct {
		item      roomcatalog.Item
		x, y, rot int
		want      bool
		reason    string
	}{
		{table, 4, 13, 0, true, "mesa no canto do pátio"},
		{table, 5, 11, 0, false, "fora da largura do pátio"},
		{table, 0, 11, 0, false, "coluna da parede ao lado do pátio"},
		{table, 2, 14, 0, false, "além do fundo do pátio"},
		{window, 0, 11, 0, false, "janela não vai para o pátio"},
		{window, 0, 9, 0, true, "janela na parede do café"},
	}
	for _, c := range cases {
		if got := validRoomPosition(c.item, c.x, c.y, c.rot, area); got != c.want {
			t.Fatalf("%s: %v", c.reason, got)
		}
	}
}
