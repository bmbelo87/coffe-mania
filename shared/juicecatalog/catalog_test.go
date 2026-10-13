package juicecatalog

import "testing"

func TestJuiceGroupsRequireAllPreviousFlavors(t *testing.T) {
	mastery := map[string]int{}
	if !Unlocked("basic", mastery) || Unlocked("medium", mastery) || Unlocked("tropical", mastery) || Unlocked("unknown", mastery) {
		t.Fatal("incorrect initial group availability")
	}
	for _, recipe := range Recipes {
		if recipe.Group == "basic" {
			mastery[recipe.ID] = MasteryServings
		}
	}
	mastery["lemon"]--
	if Unlocked("medium", mastery) {
		t.Fatal("one incomplete basic flavor must keep medium locked")
	}
	mastery["lemon"]++
	if !Unlocked("medium", mastery) || Unlocked("tropical", mastery) {
		t.Fatal("completing basics must unlock only medium")
	}
	for _, recipe := range Recipes {
		if recipe.Group == "medium" {
			mastery[recipe.ID] = MasteryServings
		}
	}
	if !Unlocked("tropical", mastery) {
		t.Fatal("completing medium must unlock tropical")
	}
}

func TestJuiceMachineEvolutionRequiresCompleteGroups(t *testing.T) {
	mastery := map[string]int{}
	if EvolutionStage(mastery) != 1 {
		t.Fatal("new machine must start at stage one")
	}
	for index, group := range []string{"basic", "medium", "tropical"} {
		for _, recipe := range Recipes {
			if recipe.Group == group {
				mastery[recipe.ID] = MasteryServings
			}
		}
		if EvolutionStage(mastery) != index+2 {
			t.Fatal("complete group must advance exactly one stage")
		}
	}
	mastery["orange"]--
	if EvolutionStage(mastery) != 1 {
		t.Fatal("incomplete prerequisite must prevent later evolution")
	}
}
