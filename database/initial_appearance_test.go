package main

import (
	"coffe-mania/database/appearance"
	"coffe-mania/database/playerstate"
	"coffe-mania/shared/avatarappearance"
	"testing"
)

func TestInitialAppearanceProvisioningAndSavedCustomization(t *testing.T) {
	app, owner := newCookingTestApp(t)
	state, err := playerstate.GetOrCreate(app, owner)
	if err != nil {
		t.Fatal(err)
	}
	want, err := appearance.Validate(avatarappearance.Starter)
	if err != nil {
		t.Fatal(err)
	}
	if state.GetString("appearance") != want || playerstate.View(state).Appearance != want {
		t.Fatal("new player did not receive the shared initial look")
	}
	custom, err := appearance.Validate(`{"version":1,"itemIds":[1050000,1060000,1000009,1020027,1030000,1040005,1090000,1080000,1070001],"skinColour":16772329,"hairColour":4605510}`)
	if err != nil {
		t.Fatal(err)
	}
	state.Set("appearance", custom)
	if err := app.Save(state); err != nil {
		t.Fatal(err)
	}
	reloaded, err := playerstate.GetOrCreate(app, owner)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.GetString("appearance") != custom {
		t.Fatal("entry overwrote saved customization")
	}
}
