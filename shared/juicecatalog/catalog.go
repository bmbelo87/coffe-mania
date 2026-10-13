package juicecatalog

import (
	"embed"
	"encoding/json"
)

//go:embed catalog.json
var files embed.FS

type Recipe struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Group            string `json:"group"`
	EnergyCost       int64  `json:"energyCost"`
	Portions         int    `json:"portions"`
	Gold             int64  `json:"gold"`
	XP               int64  `json:"xp"`
	PopularityTenths int64  `json:"popularityTenths"`
}

var Recipes []Recipe
var MasteryServings int

func init() {
	var catalog struct {
		Recipes         []Recipe `json:"recipes"`
		MasteryServings int      `json:"masteryServings"`
	}
	data, err := files.ReadFile("catalog.json")
	if err != nil {
		panic(err)
	}
	if err = json.Unmarshal(data, &catalog); err != nil {
		panic(err)
	}
	Recipes = catalog.Recipes
	MasteryServings = catalog.MasteryServings
	seen := map[string]bool{}
	for _, r := range Recipes {
		if seen[r.ID] || r.ID == "" || r.EnergyCost < 1 || r.Portions < 1 || r.Gold < 0 || r.XP < 0 || r.PopularityTenths < 0 || (r.Group != "basic" && r.Group != "medium" && r.Group != "tropical") {
			panic("invalid juice catalogue")
		}
		seen[r.ID] = true
	}
	if MasteryServings < 1 {
		panic("invalid juice mastery")
	}
}
func ByID(id string) (Recipe, bool) {
	for _, r := range Recipes {
		if r.ID == id {
			return r, true
		}
	}
	return Recipe{}, false
}
func Unlocked(group string, mastery map[string]int) bool {
	if group == "basic" {
		return true
	}
	previous := "basic"
	if group == "tropical" {
		previous = "medium"
	}
	if group != "medium" && group != "tropical" {
		return false
	}
	for _, r := range Recipes {
		if r.Group == previous && mastery[r.ID] < MasteryServings {
			return false
		}
	}
	return true
}

// Evolution is derived from durable mastery; clients cannot choose the room sprite stage.
func EvolutionStage(mastery map[string]int) int {
	stage := 1
	for _, group := range []string{"basic", "medium", "tropical"} {
		for _, recipe := range Recipes {
			if recipe.Group == group && mastery[recipe.ID] < MasteryServings {
				return stage
			}
		}
		stage++
	}
	return stage
}
