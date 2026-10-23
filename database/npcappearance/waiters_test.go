package npcappearance

import (
	"encoding/json"
	"reflect"
	"testing"

	"coffe-mania/database/appearance"
)

func staffTestPolicy(t *testing.T) Snapshot {
	t.Helper()
	entries, err := Entries()
	if err != nil {
		t.Fatal(err)
	}
	policy := Snapshot{Version: 1, SkinColours: []int{15718301, 14532522}, HairColours: []int{4924943, 3354150}}
	for _, entry := range entries {
		if entry.Kind == "item" {
			policy.ItemIDs = append(policy.ItemIDs, entry.ItemID)
		}
	}
	return policy
}
func staffSlots(t *testing.T, value string) map[string]int {
	t.Helper()
	var look struct {
		ItemIDs []int `json:"itemIds"`
	}
	if _, err := appearance.Validate(value); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(value), &look); err != nil {
		t.Fatal(err)
	}
	slots := map[string]int{}
	for _, id := range look.ItemIDs {
		slots[appearance.SlotOf(id)] = id
	}
	return slots
}
func TestWaiterFacesAreDiverseStableAndKeepUniform(t *testing.T) {
	policy := staffTestPolicy(t)
	looks, err := GenerateWaiterLooks(policy, "room-a", 7)
	if err != nil {
		t.Fatal(err)
	}
	again, err := GenerateWaiterLooks(policy, "room-a", 7)
	if err != nil || !reflect.DeepEqual(looks, again) {
		t.Fatal("opening the menu rerolled employee faces", err)
	}
	initial := staffSlots(t, appearance.Initial())
	pairs := map[[2]int]bool{}
	eyes, mouths := map[int]bool{}, map[int]bool{}
	allowed := map[int]bool{}
	for _, id := range policy.ItemIDs {
		allowed[id] = true
	}
	for _, look := range looks {
		slots := staffSlots(t, look)
		pair := [2]int{slots["Eyes"], slots["Mouth"]}
		if pairs[pair] {
			t.Fatal("employees have the same eye/mouth combination")
		}
		pairs[pair] = true
		eyes[slots["Eyes"]], mouths[slots["Mouth"]] = true, true
		for slot, id := range slots {
			switch slot {
			case "Eyes", "Mouth", "Eyebrows", "Hair":
				if !allowed[id] {
					t.Fatalf("disabled facial part %s: %d", slot, id)
				}
			default:
				if initial[slot] != id {
					t.Fatalf("random face changed the uniform slot %s", slot)
				}
			}
		}
	}
	if len(eyes) < 2 || len(mouths) < 2 {
		t.Fatal("eye and mouth variation is missing")
	}
	other, err := GenerateWaiterLooks(policy, "room-b", 7)
	if err != nil || reflect.DeepEqual(looks, other) {
		t.Fatal("different cafés share the same roster faces", err)
	}
}
func TestWaiterFacesRespectRestrictedCatalogAndPolicyOrder(t *testing.T) {
	policy := staffTestPolicy(t)
	first, err := GenerateWaiterLooks(policy, "room-a", 7)
	if err != nil {
		t.Fatal(err)
	}
	for i, j := 0, len(policy.ItemIDs)-1; i < j; i, j = i+1, j-1 {
		policy.ItemIDs[i], policy.ItemIDs[j] = policy.ItemIDs[j], policy.ItemIDs[i]
	}
	policy.SkinColours[0], policy.SkinColours[1] = policy.SkinColours[1], policy.SkinColours[0]
	second, err := GenerateWaiterLooks(policy, "room-a", 7)
	if err != nil || !reflect.DeepEqual(first, second) {
		t.Fatal("policy ordering rerolled employee faces", err)
	}
	filtered := []int{}
	for _, id := range policy.ItemIDs {
		if appearance.SlotOf(id) != "Mouth" {
			filtered = append(filtered, id)
		}
	}
	policy.ItemIDs = filtered
	if _, err := GenerateWaiterLooks(policy, "room-a", 7); err == nil {
		t.Fatal("missing mouth allowlist silently enabled forbidden pieces")
	}
}
