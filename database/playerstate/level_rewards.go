package playerstate

import (
	_ "embed"
	"encoding/json"
	"strconv"

	"coffe-mania/shared/recipecatalog"
	"github.com/pocketbase/pocketbase/core"
)

//go:embed level-extras.json
var levelExtrasJSON []byte

var levelExtras = func() struct {
	WaiterLevels []int             `json:"waiterLevels"`
	Titles       map[string]string `json:"titles"`
} {
	var data struct {
		WaiterLevels []int             `json:"waiterLevels"`
		Titles       map[string]string `json:"titles"`
	}
	if err := json.Unmarshal(levelExtrasJSON, &data); err != nil {
		panic(err)
	}
	return data
}()

type UnlockedRecipe struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// These receipts describe rewards already committed with XP, never a client claim for payment.
type LevelReward struct {
	Level       int              `json:"level"`
	Title       string           `json:"title,omitempty"`
	Gold        int64            `json:"gold"`
	Waiters     int              `json:"waiters"`
	WaiterSlots int              `json:"waiterSlots"`
	Recipes     []UnlockedRecipe `json:"recipes"`
}

func WaiterSlots(level int) int {
	count := 0
	for _, minimum := range levelExtras.WaiterLevels {
		if level >= minimum {
			count++
		}
	}
	return count
}

func RewardForLevel(level int) LevelReward {
	level = min(max(level, 1), MaxLevel())
	result := LevelReward{Level: level, Title: levelExtras.Titles[strconv.Itoa(level)],
		Gold: levels[level-1].RewardGold, Waiters: WaiterSlots(level) - WaiterSlots(level-1),
		WaiterSlots: WaiterSlots(level), Recipes: []UnlockedRecipe{}}
	for _, recipe := range recipecatalog.Recipes {
		if recipe.InBook && recipe.Level == level {
			result.Recipes = append(result.Recipes, UnlockedRecipe{ID: recipe.ID, Name: recipe.Name})
		}
	}
	return result
}

func PendingLevelRewards(record *core.Record) []LevelReward {
	var rewards []LevelReward
	_ = record.UnmarshalJSONField("level_notifications", &rewards)
	if rewards == nil {
		return []LevelReward{}
	}
	return rewards
}

// Removing a receipt is idempotent and cannot change gold, XP, or another level's receipt.
func AcknowledgeLevel(record *core.Record, level int) {
	rewards := PendingLevelRewards(record)
	remaining := make([]LevelReward, 0, len(rewards))
	for _, reward := range rewards {
		if reward.Level != level {
			remaining = append(remaining, reward)
		}
	}
	record.Set("level_notifications", remaining)
}
