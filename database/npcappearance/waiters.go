package npcappearance

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"sort"
	"strings"

	"coffe-mania/database/appearance"
)

// Staff use the existing facial parts and the NPC allowlist, with the initial
// uniform retained. A room seed makes candidates stable across reads/restarts.
func GenerateWaiterLooks(policy Snapshot, seed string, count int) ([]string, error) {
	if count < 0 || count > 16 {
		return nil, fmt.Errorf("quantidade de garçons inválida")
	}
	var wardrobe wardrobeFile
	var atlas struct {
		Symbols map[string]json.RawMessage `json:"symbols"`
	}
	if err := json.Unmarshal(wardrobeJSON, &wardrobe); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(atlasJSON, &atlas); err != nil {
		return nil, err
	}
	allowed := map[int]bool{}
	for _, id := range policy.ItemIDs {
		allowed[id] = true
	}
	parents := map[string]string{}
	for _, group := range wardrobe.Groups {
		slot := group.Name
		if group.Parent != "" {
			slot = group.Parent
		}
		parents[group.Name] = slot
	}
	pools := map[string][]wardrobeItem{"Hair": {}, "Eyes": {}, "Mouth": {}, "Eyebrows": {}}
	for _, item := range wardrobe.Items {
		slot := parents[item.Group]
		if _, facial := pools[slot]; !facial || !allowed[item.ID] || item.Invisible || len(item.Hidden) != 0 {
			continue
		}
		if item.Texture != "" {
			if _, exists := atlas.Symbols[item.Texture]; !exists {
				continue
			}
		}
		if slot == "Hair" {
			usable := false
			for _, object := range item.Objects {
				usable = usable || strings.HasPrefix(object, "hair")
			}
			if !usable {
				continue
			}
		} else if item.Texture == "" {
			continue
		}
		pools[slot] = append(pools[slot], item)
	}
	digest := sha256.Sum256([]byte("coffe-waiters-face-v1:" + seed))
	random := rand.New(rand.NewPCG(binary.LittleEndian.Uint64(digest[:8]), binary.LittleEndian.Uint64(digest[8:16])))
	for _, slot := range []string{"Eyes", "Mouth", "Hair", "Eyebrows"} {
		pool := pools[slot]
		if len(pool) == 0 {
			return nil, fmt.Errorf("nenhuma peça de garçom utilizável para %s", slot)
		}
		sort.Slice(pool, func(i, j int) bool { return pool[i].ID < pool[j].ID })
		random.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
	}
	// Distinct eye/mouth pairs guarantee visible face variety, rather than relying
	// on hair colour to make otherwise identical employees look different.
	type face struct{ eyes, mouth int }
	faces := []face{}
	for _, eyes := range pools["Eyes"] {
		for _, mouth := range pools["Mouth"] {
			faces = append(faces, face{eyes.ID, mouth.ID})
		}
	}
	random.Shuffle(len(faces), func(i, j int) { faces[i], faces[j] = faces[j], faces[i] })
	var initial struct {
		Version    int   `json:"version"`
		ItemIDs    []int `json:"itemIds"`
		SkinColour int   `json:"skinColour"`
		HairColour int   `json:"hairColour"`
	}
	if err := json.Unmarshal([]byte(appearance.Initial()), &initial); err != nil {
		return nil, err
	}
	if len(policy.SkinColours) == 0 || len(policy.HairColours) == 0 {
		return nil, fmt.Errorf("paleta vazia para garçons")
	}
	skin := append([]int{}, policy.SkinColours...)
	hair := append([]int{}, policy.HairColours...)
	sort.Ints(skin)
	sort.Ints(hair)
	// Match customer sampling: unusual skin/hair colours use a 5% gate.
	colour := func(pool []int, rareSet map[int]bool) int {
		common, rare := []int{}, []int{}
		for _, value := range pool {
			if rareSet[value] {
				rare = append(rare, value)
			} else {
				common = append(common, value)
			}
		}
		selected := common
		if len(selected) == 0 || len(rare) > 0 && random.Float64() < .05 {
			selected = rare
		}
		return selected[random.IntN(len(selected))]
	}
	rareSkin := map[int]bool{0xa4dfe3: true, 0xa4aee3: true, 0xe3a4dd: true, 0x98e3a0: true, 0xb3b3b3: true, 0xcce3e2: true}
	rareHair := map[int]bool{0x332e26: true, 0: true, 0xbd4040: true, 0x852121: true, 0x541152: true, 0x7a69bf: true}
	looks := make([]string, 0, count)
	for i := 0; i < count; i++ {
		look := initial
		look.ItemIDs = append([]int{}, initial.ItemIDs...)
		selected := faces[i%len(faces)]
		replacements := map[string]int{"Eyes": selected.eyes, "Mouth": selected.mouth,
			"Hair": pools["Hair"][i%len(pools["Hair"])].ID, "Eyebrows": pools["Eyebrows"][i%len(pools["Eyebrows"])].ID}
		for index, id := range look.ItemIDs {
			if replacement, exists := replacements[appearance.SlotOf(id)]; exists {
				look.ItemIDs[index] = replacement
			}
		}
		look.SkinColour = colour(skin, rareSkin)
		look.HairColour = colour(hair, rareHair)
		encoded, _ := json.Marshal(look)
		normalized, err := appearance.Validate(string(encoded))
		if err != nil {
			return nil, err
		}
		looks = append(looks, normalized)
	}
	return looks, nil
}
