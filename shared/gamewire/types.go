// Package gamewire is the protocol between the independent room service and persistence.
// It has no database, renderer or PocketBase dependency.
package gamewire

import "encoding/json"

type Tile struct {
	X int `json:"tx"`
	Y int `json:"ty"`
}
type Unit struct {
	ID       string `json:"unitId"`
	ItemID   int    `json:"itemId"`
	Placed   bool   `json:"placed"`
	X        int    `json:"tx"`
	Y        int    `json:"ty"`
	Rotation int    `json:"rotation"`
	StoveID  string `json:"stoveId,omitempty"`
}

// Food is a counter's dish. Counter is empty for dishes saved before counters existed.
type Food struct {
	ID       string `json:"id"`
	Recipe   string `json:"recipeId"`
	Counter  string `json:"counterId,omitempty"`
	Portions int    `json:"portions,omitempty"`
}

// MealReturn is created by the room from a customer's live meal, never by browser input.
type MealReturn struct {
	CustomerID string `json:"customerId"`
	RecipeID   string `json:"recipeId"`
}

type JuiceStock struct {
	MachineID string `json:"machineId"`
	RecipeID  string `json:"recipeId"`
	Portions  int    `json:"portions"`
	Unlocked  bool   `json:"unlocked"`
	Stage     int    `json:"stage"`
}
type Employee struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Appearance string `json:"appearance"`
}
type World struct {
	RoomID   string `json:"roomId"`
	Revision int    `json:"revision"`
	TilesX   int    `json:"tilesX"`
	TilesY   int    `json:"tilesY"`
	// PatioX and PatioY are the patio floor beyond the café's front-left edge (0 without one).
	PatioX  int             `json:"patioX"`
	PatioY  int             `json:"patioY"`
	Units   []Unit          `json:"units"`
	Foods   []Food          `json:"foods"`
	Cooking json.RawMessage `json:"cooking,omitempty"`
	Juices  []JuiceStock    `json:"juices"`
	// nil denotes a legacy room without waiter simulation; an empty list requires hiring.
	Employees []Employee `json:"employees"`
}
type Movement struct {
	From      Tile  `json:"from"`
	To        Tile  `json:"to"`
	StartedAt int64 `json:"startedAt"`
	Duration  int64 `json:"duration"`
}
type ActorAction struct {
	Kind      string `json:"kind"`
	StoveID   string `json:"stoveId,omitempty"`
	StartedAt int64  `json:"startedAt"`
	Duration  int64  `json:"duration"`
}
type Emotion struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	StartedAt int64  `json:"startedAt"`
	Duration  int64  `json:"duration"`
}
type Actor struct {
	ID              string       `json:"id"`
	Kind            string       `json:"kind,omitempty"`
	Name            string       `json:"name,omitempty"`
	Appearance      string       `json:"appearance,omitempty"`
	X               int          `json:"tx"`
	Y               int          `json:"ty"`
	Direction       int          `json:"direction"`
	Outside         bool         `json:"outside"`
	State           string       `json:"state"`
	Move            *Movement    `json:"move,omitempty"`
	ChairID         string       `json:"chairId,omitempty"`
	TableID         string       `json:"tableId,omitempty"`
	Food            *Food        `json:"food,omitempty"`
	ActionRemaining int64        `json:"actionRemaining,omitempty"`
	Action          *ActorAction `json:"action,omitempty"`
	Emotion         *Emotion     `json:"emotion,omitempty"`
	EmotionShown    bool         `json:"emotionShown,omitempty"`
	// Paths/timers are saved only on dormancy; they are never broadcast in hot updates.
	Path   []Tile `json:"path,omitempty"`
	Visits int    `json:"visits,omitempty"`
	// A customer's verdict is applied once: Ate marks a served meal, Judged a recorded visit.
	Ate              bool   `json:"ate,omitempty"`
	Judged           bool   `json:"judged,omitempty"`
	JuiceRequestID   string `json:"juiceRequestId,omitempty"`
	WaiterCustomerID string `json:"waiterCustomerId,omitempty"`
	WaiterFoodID     string `json:"waiterFoodId,omitempty"`
}

// Business is the owner's private progress that drives the room: customer frequency
// follows popularity (in tenths, as persisted) and level.
type Business struct {
	Popularity int64 `json:"popularity"`
	Level      int   `json:"level"`
}
type Seed struct {
	World    World    `json:"world"`
	NPCs     []Actor  `json:"npcs"`
	Looks    []string `json:"looks"`
	Business Business `json:"business"`
	Waiters  []Actor  `json:"waiters"`
}
type Sleep struct {
	NPCs    []Actor `json:"npcs"`
	Waiters []Actor `json:"waiters"`
}
type Operation struct {
	Owner  string          `json:"owner"`
	User   string          `json:"user"`
	Action string          `json:"action"`
	Body   json.RawMessage `json:"body"`
}
type Result struct {
	Status   int             `json:"status"`
	Body     json.RawMessage `json:"body"`
	World    *World          `json:"world,omitempty"`
	Business *Business       `json:"business,omitempty"`
}
type Event struct {
	Type      string   `json:"type"`
	Epoch     string   `json:"epoch"`
	Seq       uint64   `json:"seq"`
	ServerNow int64    `json:"serverNow"`
	SelfID    string   `json:"selfId,omitempty"`
	World     *World   `json:"world,omitempty"`
	Actors    []Actor  `json:"actors,omitempty"`
	Removed   []string `json:"removed,omitempty"`
	Units     []Unit   `json:"units,omitempty"`
	Revision  int      `json:"revision,omitempty"`
	// TilesX and TilesY accompany a "world" event when the café or its patio changed size; the
	// patio fields are then the full patio size (omitted when there is none).
	TilesX    int             `json:"tilesX,omitempty"`
	TilesY    int             `json:"tilesY,omitempty"`
	PatioX    int             `json:"patioX,omitempty"`
	PatioY    int             `json:"patioY,omitempty"`
	Cooking   json.RawMessage `json:"cooking,omitempty"`
	Foods     []Food          `json:"foods,omitempty"`
	Juices    []JuiceStock    `json:"juices,omitempty"`
	RequestID string          `json:"requestId,omitempty"`
	Message   string          `json:"message,omitempty"`
}
type Command struct {
	Type      string `json:"type"`
	Ticket    string `json:"ticket,omitempty"`
	// Version is the client build (game/src/core/version.ts), sent with "join".
	Version   string `json:"version,omitempty"`
	RequestID string `json:"requestId,omitempty"`
	X         *int   `json:"tx,omitempty"`
	Y         *int   `json:"ty,omitempty"`
	ChairID   string `json:"chairId,omitempty"`
	StoveID   string `json:"stoveId,omitempty"`
	UnitID    string `json:"unitId,omitempty"`
}

// OperationStatus is the server-wide mode set by an admin. Maintenance starts at StartsAt
// (0 = now); EndsAt is only the announced estimate. Times are Unix milliseconds.
type OperationStatus struct {
	Type     string `json:"type,omitempty"`
	Mode     string `json:"mode"`
	Message  string `json:"message,omitempty"`
	StartsAt int64  `json:"startsAt,omitempty"`
	EndsAt   int64  `json:"endsAt,omitempty"`
}

const (
	ModeOpen        = "open"
	ModeMaintenance = "maintenance"
	ModeClosed      = "closed"
)

// Active reports whether ordinary players are locked out at the given instant.
func (s OperationStatus) Active(nowMs int64) bool {
	return s.Mode == ModeClosed || s.Mode == ModeMaintenance && nowMs >= s.StartsAt
}

// WebSocket close codes the client treats as final (no automatic reconnection).
const (
	CloseReplaced    = 4001 // the account opened the game in another window
	CloseMaintenance = 4002 // maintenance or closed alpha
	CloseOutdated    = 4003 // client build differs from the server
)

// Latency is private transport telemetry, outside the ordered room event stream.
type Latency struct {
	Type  string  `json:"type"`
	RTTMs float64 `json:"rttMs"`
}

// TelemetryEvent is a play session fact the room service reports to the telemetry
// (database/telemetry.go): "session_start" when a connection joins a café and "session_end"
// with its duration in seconds and how it ended. Session is the connection's id; At is Unix ms.
type TelemetryEvent struct {
	Name    string  `json:"name"`
	User    string  `json:"user"`
	Session string  `json:"session"`
	Label   string  `json:"label,omitempty"`
	Seconds float64 `json:"seconds,omitempty"`
	At      int64   `json:"at"`
}
