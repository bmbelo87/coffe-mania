package migrations

import (
	"coffe-mania/database/starterroom"
	"coffe-mania/shared/roomcatalog"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() { m.Register(ArrangeStarterKitchens, nil) }

// ArrangeStarterKitchens moves only intact starter kitchens, retaining every unit and cooking record.
func ArrangeStarterKitchens(app core.App) error {
	return app.RunInTransaction(func(tx core.App) error {
		rooms, err := tx.FindAllRecords("player_rooms")
		if err != nil {
			return err
		}
		legacy := [6]starterroom.Placement{
			{3070000, 1, 7, 3}, {3070000, 3, 7, 3}, {3070000, 2, 8, 1},
			{3020069, 2, 7, 3}, {3020069, 1, 8, 1}, {3020069, 3, 8, 1},
		}
		for _, room := range rooms {
			if room.GetInt("tiles_x") < 4 || room.GetInt("tiles_y") < 10 {
				continue
			}
			units, err := tx.FindRecordsByFilter("player_inventory", "user={:user} && placed=true && layer='object'", "", 0, 0, dbx.Params{"user": room.GetString("user")})
			if err != nil {
				return err
			}
			var selected [6]*core.Record
			blocked := false
			for _, unit := range units {
				matched := false
				for i, old := range legacy {
					if unit.GetInt("item_id") == old.ItemID && unit.GetInt("tx") == old.TX && unit.GetInt("ty") == old.TY && unit.GetInt("rotation") == old.Rotation {
						selected[i] = unit
						matched = true
						break
					}
				}
				if matched {
					continue
				}
				item, ok := roomcatalog.ByID(unit.GetInt("item_id"))
				if !ok {
					blocked = true
					break
				}
				sx, sy := item.SizeX, item.SizeY
				if unit.GetInt("rotation")%2 == 1 {
					sx, sy = sy, sx
				}
				x, y := unit.GetInt("tx"), unit.GetInt("ty")
				// Reserve both rows and their whole connecting aisle, including overlapping footprints.
				if x < 4 && x+sx > 1 && y < 10 && y+sy > 7 {
					blocked = true
					break
				}
			}
			for _, unit := range selected {
				if unit == nil {
					blocked = true
				}
			}
			if blocked {
				continue
			}
			// Release the unique placement keys before swapping occupied starter tiles.
			for _, unit := range selected {
				unit.Set("placed", false)
				if err := tx.Save(unit); err != nil {
					return err
				}
			}
			for i, piece := range starterroom.Kitchen() {
				unit := selected[i]
				unit.Set("tx", piece.TX)
				unit.Set("ty", piece.TY)
				unit.Set("rotation", piece.Rotation)
				unit.Set("placed", true)
				if err := tx.Save(unit); err != nil {
					return err
				}
				if stoveID := unit.GetString("stove_id"); stoveID != "" {
					stove, err := tx.FindRecordById("player_stoves", stoveID)
					if err != nil {
						return err
					}
					stove.Set("tx", piece.TX)
					stove.Set("ty", piece.TY)
					if err := tx.Save(stove); err != nil {
						return err
					}
				}
			}
			room.Set("revision", room.GetInt("revision")+1)
			if err := tx.Save(room); err != nil {
				return err
			}
		}
		return nil
	})
}
