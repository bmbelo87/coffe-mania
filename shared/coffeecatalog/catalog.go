// Package coffeecatalog contains the observed coffee economy and explicit provisional progression.
package coffeecatalog

import (
	"embed"
	"encoding/json"
)

//go:embed catalog.json
var files embed.FS

const MachineItemID = 9100002
const DefaultRecipeID = "espresso"

// MaximumOwned and RechargeCash are project adaptations recorded in catalog.json.
const MaximumOwned = 1
const RechargeCash int64 = 4

type Recipe struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Group            string `json:"group"`
	EnergyCost       int64  `json:"energyCost"`
	Gold             int64  `json:"gold"`
	XP               int64  `json:"xp"`
	PopularityTenths int64  `json:"popularityTenths"`
	MasteryReward    string `json:"masteryReward"`
}

var Recipes []Recipe
var MasteryThresholds [3]int
var Groups = []string{"basic", "medium", "advanced", "expert"}

func init() {
	var catalog struct {
		Recipes           []Recipe `json:"recipes"`
		MasteryThresholds [3]int   `json:"masteryThresholds"`
	}
	data, err := files.ReadFile("catalog.json")
	if err != nil {
		panic(err)
	}
	if err = json.Unmarshal(data, &catalog); err != nil {
		panic(err)
	}
	Recipes, MasteryThresholds = catalog.Recipes, catalog.MasteryThresholds
	if MasteryThresholds[0] < 1 || MasteryThresholds[1] <= MasteryThresholds[0] || MasteryThresholds[2] <= MasteryThresholds[1] {
		panic("invalid coffee mastery thresholds")
	}
	seen := map[string]bool{}
	counts := map[string]int{}
	for _, recipe := range Recipes {
		knownGroup := false
		for _, group := range Groups {
			knownGroup = knownGroup || recipe.Group == group
		}
		if recipe.ID == "" || seen[recipe.ID] || !knownGroup || recipe.EnergyCost < 1 || recipe.Gold < 0 || recipe.XP < 0 || recipe.PopularityTenths < 0 {
			panic("invalid coffee catalogue")
		}
		seen[recipe.ID] = true
		counts[recipe.Group]++
	}
	for _, group := range Groups {
		if counts[group] != 4 {
			panic("coffee catalogue must have four recipes per group")
		}
	}
}

func ByID(id string) (Recipe, bool) {
	for _, recipe := range Recipes {
		if recipe.ID == id {
			return recipe, true
		}
	}
	return Recipe{}, false
}

// MasteryLevel counts completed cumulative milestones, from zero to three.
func MasteryLevel(served int) int {
	level := 0
	for _, threshold := range MasteryThresholds {
		if served >= threshold {
			level++
		}
	}
	return level
}

func GroupDominated(group string, mastery map[string]int) bool {
	count := 0
	for _, recipe := range Recipes {
		if recipe.Group != group {
			continue
		}
		count++
		if MasteryLevel(mastery[recipe.ID]) != 3 {
			return false
		}
	}
	return count == 4
}

// Unlocked checks every preceding group, so inconsistent partial saves cannot skip a prerequisite.
func Unlocked(group string, mastery map[string]int) bool {
	for _, previous := range Groups {
		if previous == group {
			return true
		}
		if !GroupDominated(previous, mastery) {
			return false
		}
	}
	return false
}

// EvolutionStage is provisional: the three supplied appearances are associated with basic/medium mastery.
func EvolutionStage(mastery map[string]int) int {
	if !GroupDominated("basic", mastery) {
		return 1
	}
	if !GroupDominated("medium", mastery) {
		return 2
	}
	return 3
}
