package main

import (
	"errors"

	"coffe-mania/database/npcappearance"
	"coffe-mania/database/playerstate"
	"coffe-mania/shared/gamewire"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// PROVISIONAL: one initial local employee preserves the existing service. The 2010
// sources disagree on the first vacancy (level 1/3); none proves an automatic hire.
const provisionalInitialWaiters = 1

// PROVISIONAL: local candidates replace the retired Orkut friend picker. Hiring is free;
// no historical price was verified. This does not implement social-account employees.
func waiterCandidates(app core.App, owner string) ([]gamewire.Employee, error) {
	names := []string{"André", "Bia", "Carlos", "Duda", "Edu", "Flávia", "Gustavo"}
	policy, err := npcappearance.Load(app)
	if err != nil {
		return nil, err
	}
	looks, err := npcappearance.GenerateWaiterLooks(policy, owner, len(names))
	if err != nil {
		return nil, err
	}
	result := make([]gamewire.Employee, 0, len(names))
	for i, name := range names {
		result = append(result, gamewire.Employee{ID: string(rune('a' + i)), Name: name, Appearance: looks[i]})
	}
	return result, nil
}

func employeesFromRecord(record *core.Record, candidates []gamewire.Employee) []gamewire.Employee {
	var employees []gamewire.Employee
	_ = record.UnmarshalJSONField("employees", &employees)
	if employees == nil {
		return append([]gamewire.Employee{}, candidates[:provisionalInitialWaiters]...)
	}
	// Local employees keep their IDs/names and get the same stable face as their card.
	for index, employee := range employees {
		for _, candidate := range candidates {
			if candidate.ID == employee.ID {
				employees[index].Appearance = candidate.Appearance
				break
			}
		}
	}
	return employees
}

func publicEmployees(app core.App, owner string) ([]gamewire.Employee, error) {
	record, err := app.FindFirstRecordByData("player_rooms", "user", owner)
	if err != nil {
		return nil, err
	}
	candidates, err := waiterCandidates(app, owner)
	if err != nil {
		return nil, err
	}
	return employeesFromRecord(record, candidates), nil
}

type waiterCommand struct {
	CandidateID string `json:"candidateId"`
}
type waiterSnapshot struct {
	Employees    []gamewire.Employee `json:"employees"`
	Candidates   []gamewire.Employee `json:"candidates"`
	UnlockLevels []int               `json:"unlockLevels"`
	Slots        int                 `json:"slots"`
}

func snapshotWaiters(app core.App, owner string) (waiterSnapshot, error) {
	employees, err := publicEmployees(app, owner)
	if err != nil {
		return waiterSnapshot{}, err
	}
	state, err := app.FindFirstRecordByData(playerstate.Collection, "user", owner)
	if err != nil {
		return waiterSnapshot{}, err
	}
	levels := []int{}
	for level := 1; level <= playerstate.MaxLevel(); level++ {
		for count := playerstate.WaiterSlots(level - 1); count < playerstate.WaiterSlots(level); count++ {
			levels = append(levels, level)
		}
	}
	candidates, err := waiterCandidates(app, owner)
	if err != nil {
		return waiterSnapshot{}, err
	}
	return waiterSnapshot{employees, candidates, levels, playerstate.WaiterSlots(state.GetInt("level"))}, nil
}
func hireWaiter(app core.App, owner, candidateID string) error {
	candidates, err := waiterCandidates(app, owner)
	if err != nil {
		return err
	}
	var candidate *gamewire.Employee
	for _, entry := range candidates {
		if entry.ID == candidateID {
			value := entry
			candidate = &value
			break
		}
	}
	if candidate == nil {
		return errors.New("Empregado indisponível.")
	}
	return app.RunInTransaction(func(tx core.App) error {
		room, err := tx.FindFirstRecordByData("player_rooms", "user", owner)
		if err != nil {
			return err
		}
		employees := employeesFromRecord(room, candidates)
		for _, employee := range employees {
			if employee.ID == candidateID {
				return nil
			}
		} // idempotent retry, including concurrent clicks
		state, err := tx.FindFirstRecordByData(playerstate.Collection, "user", owner)
		if err != nil {
			return err
		}
		if len(employees) >= playerstate.WaiterSlots(state.GetInt("level")) {
			return errors.New("Todas as vagas estão preenchidas. Suba de nível para liberar mais.")
		}
		room.Set("employees", append(employees, *candidate))
		return tx.Save(room)
	})
}

func registerWaiterRoutes(e *core.ServeEvent) {
	e.Router.GET("/api/coffe/waiters", func(r *core.RequestEvent) error {
		r.Response.Header().Set("Cache-Control", "no-store")
		user := sessionRecord(r)
		if user == nil {
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		snapshot, err := snapshotWaiters(r.App, user.Id)
		if err != nil {
			return r.InternalServerError("Não foi possível carregar os empregados.", err)
		}
		return r.JSON(200, snapshot)
	})
	e.Router.POST("/api/coffe/waiters/hire", func(r *core.RequestEvent) error {
		user := sessionRecord(r)
		if user == nil {
			return r.UnauthorizedError("Entre para jogar.", nil)
		}
		var body waiterCommand
		if r.BindBody(&body) != nil {
			return r.BadRequestError("Pedido inválido.", nil)
		}
		return proxyRoomOperation(r, user.Id, "waiter_hire", body)
	}).Bind(apis.BodyLimit(1024)).BindFunc(func(r *core.RequestEvent) error {
		if r.Request.Header.Get("Origin") == "" {
			return r.ForbiddenError("Origem inválida.", nil)
		}
		return sameOrigin(r)
	})
}
