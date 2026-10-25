package coffeecatalog

import "testing"

func TestCoffeeObservedEconomyAndMastery(t *testing.T) {
	if len(Recipes) != 16 {
		t.Fatal("expected the sixteen observed recipes")
	}
	espresso, ok := ByID(DefaultRecipeID)
	if !ok || espresso.EnergyCost != 5 || espresso.Gold != 23 || espresso.XP != 2 || espresso.PopularityTenths != 6 {
		t.Fatal("espresso does not match the observed video")
	}
	if MasteryLevel(19) != 0 || MasteryLevel(20) != 1 || MasteryLevel(50) != 2 || MasteryLevel(100) != 3 || MasteryLevel(500) != 3 {
		t.Fatal("cumulative mastery milestones changed")
	}
}

func TestCoffeeGroupsAndEvolutionRequireAllEarlierFlavors(t *testing.T) {
	mastery := map[string]int{}
	if !Unlocked("basic", mastery) || Unlocked("medium", mastery) || Unlocked("expert", mastery) || Unlocked("unknown", mastery) {
		t.Fatal("incorrect initial availability")
	}
	for _, group := range Groups {
		for _, recipe := range Recipes {
			if recipe.Group == group {
				mastery[recipe.ID] = MasteryThresholds[2]
			}
		}
		if !GroupDominated(group, mastery) {
			t.Fatalf("complete %s group is not dominated", group)
		}
	}
	if !Unlocked("expert", mastery) || EvolutionStage(mastery) != 3 {
		t.Fatal("complete progress must unlock expert and keep the last supplied appearance")
	}
	mastery["descafeinado"]--
	if Unlocked("medium", mastery) || Unlocked("advanced", mastery) || Unlocked("expert", mastery) || EvolutionStage(mastery) != 1 {
		t.Fatal("a missing basic milestone must prevent later groups/evolution")
	}
	mastery["descafeinado"]++
	mastery["cortado"]--
	if !Unlocked("medium", mastery) || Unlocked("advanced", mastery) || EvolutionStage(mastery) != 2 {
		t.Fatal("medium mastery must control the second appearance transition")
	}
}
