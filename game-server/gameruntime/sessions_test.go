package gameruntime

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"coffe-mania/shared/buildinfo"
	"coffe-mania/shared/gamewire"
	"github.com/coder/websocket"
	"github.com/google/uuid"
)

const sessionTestSecret = "0123456789abcdef0123456789abcdef-session-test"

type sessionStore struct{ Storage }

func (sessionStore) Load(_ context.Context, id string) (gamewire.Seed, error) {
	return gamewire.Seed{World: gamewire.World{RoomID: id, TilesX: 8, TilesY: 8}}, nil
}
func (sessionStore) Active(context.Context, string, int) error           { return nil }
func (sessionStore) Sleep(context.Context, string, gamewire.Sleep) error { return nil }

func sessionServer(t *testing.T) (*Server, string) {
	t.Helper()
	manager := New(sessionStore{}, Options{Grace: time.Hour})
	server := NewServer(manager, sessionTestSecret)
	httpServer := httptest.NewServer(server.Handler())
	t.Cleanup(func() {
		httpServer.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = manager.Close(ctx)
	})
	return server, "ws" + strings.TrimPrefix(httpServer.URL, "http") + "/game/ws"
}

type sessionClient struct {
	conn *websocket.Conn
}

// join connects like the browser; Origin matches the test server, as Accept requires.
func join(t *testing.T, address, user string, staff bool, version string) *sessionClient {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, address, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.CloseNow() })
	ticket := gamewire.SignTicket(sessionTestSecret, gamewire.Ticket{
		Nonce: uuid.NewString(), Room: "owner", User: user, Name: user, Staff: staff, Expires: time.Now().Add(time.Minute).Unix(),
	})
	data, _ := json.Marshal(gamewire.Command{Type: "join", Ticket: ticket, Version: version})
	if err = conn.Write(ctx, websocket.MessageText, data); err != nil {
		t.Fatal(err)
	}
	return &sessionClient{conn: conn}
}

// next returns the next message type, or the close code when the server ended the connection.
func (c *sessionClient) next(t *testing.T) (string, websocket.StatusCode) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for {
		_, data, err := c.conn.Read(ctx)
		if err != nil {
			var closed websocket.CloseError
			if errors.As(err, &closed) {
				return "", closed.Code
			}
			t.Fatalf("leitura: %v", err)
		}
		var event struct{ Type string }
		_ = json.Unmarshal(data, &event)
		if event.Type != "latency" {
			return event.Type, 0
		}
	}
}

// expect skips ordinary room events (other players arriving) until the wanted message.
func (c *sessionClient) expect(t *testing.T, kind string) {
	t.Helper()
	for {
		got, code := c.next(t)
		if got == kind {
			return
		}
		if code != 0 || got != "actors" && got != "world" {
			t.Fatalf("esperado %q, recebido %q (fechamento %d)", kind, got, code)
		}
	}
}

func (c *sessionClient) expectClose(t *testing.T, code int) {
	t.Helper()
	for {
		got, closed := c.next(t)
		if closed != 0 {
			if int(closed) != code {
				t.Fatalf("fechamento %d, esperado %d", closed, code)
			}
			return
		}
		if got == "" {
			t.Fatal("mensagem sem tipo")
		}
	}
}

func TestOutdatedClientIsAskedToReload(t *testing.T) {
	_, address := sessionServer(t)
	join(t, address, "ana", false, "0.0.1").expectClose(t, gamewire.CloseOutdated)
	join(t, address, "ana", false, "").expectClose(t, gamewire.CloseOutdated)
	join(t, address, "ana", false, buildinfo.Version).expect(t, "welcome")
}

func TestSecondWindowReplacesTheFirst(t *testing.T) {
	_, address := sessionServer(t)
	first := join(t, address, "ana", false, buildinfo.Version)
	first.expect(t, "welcome")
	second := join(t, address, "ana", false, buildinfo.Version)
	second.expect(t, "welcome")
	first.expectClose(t, gamewire.CloseReplaced)
	// Another account in the same room is unaffected.
	join(t, address, "bia", false, buildinfo.Version).expect(t, "welcome")
}

func TestMaintenanceCountdownThenOnlyStaffStays(t *testing.T) {
	server, address := sessionServer(t)
	player := join(t, address, "ana", false, buildinfo.Version)
	player.expect(t, "welcome")
	staff := join(t, address, "equipe", true, buildinfo.Version)
	staff.expect(t, "welcome")

	server.SetStatus(gamewire.OperationStatus{Mode: gamewire.ModeMaintenance, StartsAt: time.Now().Add(300 * time.Millisecond).UnixMilli()})
	player.expect(t, "status")
	staff.expect(t, "status")
	player.expectClose(t, gamewire.CloseMaintenance)

	join(t, address, "bia", false, buildinfo.Version).expectClose(t, gamewire.CloseMaintenance)
	late := join(t, address, "teste", true, buildinfo.Version)
	late.expect(t, "welcome")
	late.expect(t, "status")

	server.SetStatus(gamewire.OperationStatus{Mode: gamewire.ModeOpen})
	join(t, address, "bia", false, buildinfo.Version).expect(t, "welcome")
}
