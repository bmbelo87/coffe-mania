package starterroom

type Placement struct {
	ItemID, TX, TY, Rotation int
}

// Kitchen leaves y=8 open to the chef. Stoves face northeast (-y), counters face the aisle (+y).
func Kitchen() [6]Placement {
	return [6]Placement{
		{3070000, 1, 9, 3}, {3070000, 2, 9, 3}, {3070000, 3, 9, 3},
		{3020069, 1, 7, 1}, {3020069, 2, 7, 1}, {3020069, 3, 7, 1},
	}
}
