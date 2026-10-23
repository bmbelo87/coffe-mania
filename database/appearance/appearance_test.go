package appearance

import (
	"encoding/json"
	"sort"
	"testing"
)

func TestStarterPartsValidate(t *testing.T) {
	parts := map[string]int{"Eyes": 1050022, "Mouth": 1060025, "Eyebrows": 1070012, "Hair": 1040016, "Shirt": 1020056, "Pants": 1000021}
	bySlot := make(map[string]int)
	for id, slot := range itemSlots {
		if previous, exists := bySlot[slot]; !exists || id < previous {
			bySlot[slot] = id
		}
	}
	for slot, id := range parts {
		if itemSlots[id] != slot {
			t.Fatalf("peça %d não está cadastrada no slot %s", id, slot)
		}
		bySlot[slot] = id
	}
	ids := make([]int, 0, len(bySlot))
	for _, id := range bySlot {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	skin, hair := 0xefd79d, 0x4b260f
	data := look{Version: 1, ItemIDs: ids, SkinColour: &skin, HairColour: &hair}
	encoded, _ := json.Marshal(data)
	validated, err := Validate(string(encoded))
	if err != nil {
		t.Fatalf("combinação modular rejeitada: %v", err)
	}
	if validated != string(encoded) {
		t.Fatal("normalização alterou a aparência")
	}
	t.Run("slot duplicado continua proibido", func(t *testing.T) {
		duplicate := data
		duplicate.ItemIDs = append([]int(nil), ids...)
		for index, id := range duplicate.ItemIDs {
			if itemSlots[id] == "Mouth" {
				duplicate.ItemIDs[index] = parts["Eyes"]
			}
		}
		encoded, _ := json.Marshal(duplicate)
		if _, err := Validate(string(encoded)); err == nil {
			t.Fatal("aceitou olhos no lugar de boca")
		}
	})
}
