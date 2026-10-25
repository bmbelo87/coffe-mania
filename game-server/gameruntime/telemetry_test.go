package gameruntime

import (
	"context"
	"sync"
	"testing"
	"time"

	"coffe-mania/shared/buildinfo"
	"coffe-mania/shared/gamewire"
	"github.com/coder/websocket"
)

func TestSessionTelemetryNamesHowEachConnectionEnded(t *testing.T) {
	server, address := sessionServer(t)
	var mu sync.Mutex
	var reported []gamewire.TelemetryEvent
	server.ReportTelemetry = func(_ context.Context, events []gamewire.TelemetryEvent) error {
		mu.Lock()
		defer mu.Unlock()
		reported = append(reported, events...)
		return nil
	}
	first := join(t, address, "ana", false, buildinfo.Version)
	first.expect(t, "welcome")
	join(t, address, "ana", false, buildinfo.Version).expect(t, "welcome")
	first.expectClose(t, gamewire.CloseReplaced)
	// "owner" hosts the test room, so another account is a visit.
	leaving := join(t, address, "bia", false, buildinfo.Version)
	leaving.expect(t, "welcome")
	_ = leaving.conn.Close(websocket.StatusGoingAway, "")

	ends := map[string][]string{}
	starts := map[string][]string{}
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if err := server.FlushTelemetry(context.Background()); err != nil {
			t.Fatal(err)
		}
		mu.Lock()
		ends, starts = map[string][]string{}, map[string][]string{}
		for _, event := range reported {
			if event.Name == "session_end" {
				ends[event.User] = append(ends[event.User], event.Label)
			} else {
				starts[event.User] = append(starts[event.User], event.Label)
			}
		}
		mu.Unlock()
		if len(ends["ana"]) == 1 && len(ends["bia"]) == 1 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if len(starts["ana"]) != 2 || starts["bia"][0] != "visit" || ends["ana"][0] != "replaced" || ends["bia"][0] != "left" {
		t.Fatalf("inícios %v, fins %v", starts, ends)
	}
	// Shutdown closes the telemetry of whoever is still connected.
	server.EndSessions("shutdown")
	if err := server.FlushTelemetry(context.Background()); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	last := reported[len(reported)-1]
	if last.Name != "session_end" || last.User != "ana" || last.Label != "shutdown" {
		t.Fatalf("encerramento %+v", last)
	}
}

func TestShutdownReportsTheEndOfOpenSessions(t *testing.T) {
	server, address := sessionServer(t)
	var mu sync.Mutex
	var reported []gamewire.TelemetryEvent
	server.ReportTelemetry = func(_ context.Context, events []gamewire.TelemetryEvent) error {
		mu.Lock()
		defer mu.Unlock()
		reported = append(reported, events...)
		return nil
	}
	for _, user := range []string{"ana", "bia", "caio"} {
		join(t, address, user, false, buildinfo.Version).expect(t, "welcome")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.EndSessions("shutdown")
	if err := server.Manager.Close(ctx); err != nil {
		t.Fatal(err)
	}
	if err := server.FlushTelemetry(ctx); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	ends := map[string]string{}
	for _, event := range reported {
		if event.Name == "session_end" && event.Label == "shutdown" {
			ends[event.User] = event.Label
		}
	}
	if len(ends) != 3 {
		t.Fatalf("fins %v de %d eventos", ends, len(reported))
	}
}
