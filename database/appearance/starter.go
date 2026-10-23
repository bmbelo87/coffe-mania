package appearance

import "coffe-mania/shared/avatarappearance"

// Initial is validated against the same wardrobe contract as a player's saved edits.
func Initial() string {
	value, err := Validate(avatarappearance.Starter)
	if err != nil {
		panic("invalid initial player appearance: " + err.Error())
	}
	return value
}
