package gameruntime

import (
	"context"
	"errors"
	"log"
	"strconv"
	"sync"
	"time"

	"coffe-mania/shared/gamewire"
	"github.com/coder/websocket"
)

// Play session facts go to the persistence service in batches (database/telemetry.go). The
// queue is bounded: if the database is unreachable for long, the oldest facts are lost, never
// the game.
const sessionTelemetryLimit = 10000

type sessionTelemetry struct {
	mu     sync.Mutex
	events []gamewire.TelemetryEvent
}

func (t *sessionTelemetry) add(event gamewire.TelemetryEvent) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if len(t.events) >= sessionTelemetryLimit {
		t.events = t.events[1:]
	}
	t.events = append(t.events, event)
}

func (t *sessionTelemetry) take() []gamewire.TelemetryEvent {
	t.mu.Lock()
	defer t.mu.Unlock()
	events := t.events
	t.events = nil
	return events
}

// putBack returns a batch that could not be sent, ahead of what arrived meanwhile.
func (t *sessionTelemetry) putBack(events []gamewire.TelemetryEvent) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.events = append(events, t.events...)
	if extra := len(t.events) - sessionTelemetryLimit; extra > 0 {
		t.events = t.events[extra:]
	}
}

// Telemetry posts session facts to the persistence service.
func (s *HTTPStorage) Telemetry(ctx context.Context, events []gamewire.TelemetryEvent) error {
	return s.request(ctx, "POST", "telemetry", events, nil)
}

// sessionEnd names how a connection ended, for the dashboard.
func sessionEnd(err error) string {
	switch code := websocket.CloseStatus(err); code {
	case -1:
		if errors.Is(err, context.Canceled) {
			return "closed"
		}
		return "lost"
	case websocket.StatusNormalClosure, websocket.StatusGoingAway:
		return "left"
	default:
		return strconv.Itoa(int(code))
	}
}

func (s *Server) sessionStarted(session *liveSession) {
	label := "own"
	if session.peer.Ticket.Room != session.peer.Ticket.User {
		label = "visit"
	}
	s.telemetry.add(gamewire.TelemetryEvent{Name: "session_start", User: session.peer.Ticket.User, Session: session.peer.ID, Label: label, At: session.started.UnixMilli()})
}

// sessionEnded reports the end once, with the first reason set: a replacement, maintenance,
// kick or shutdown is recorded before the connection's own read error.
func (s *Server) sessionEnded(session *liveSession, reason string) {
	if !session.joined.Load() {
		return
	}
	session.endOnce.Do(func() {
		if known := session.reason.Load(); known != nil {
			reason = *known
		}
		now := time.Now()
		s.telemetry.add(gamewire.TelemetryEvent{Name: "session_end", User: session.peer.Ticket.User, Session: session.peer.ID, Label: reason,
			Seconds: now.Sub(session.started).Seconds(), At: now.UnixMilli()})
	})
}

// FlushTelemetry sends what is queued. It is called every few seconds and at shutdown.
func (s *Server) FlushTelemetry(ctx context.Context) error {
	if s.ReportTelemetry == nil {
		return nil
	}
	events := s.telemetry.take()
	if len(events) == 0 {
		return nil
	}
	if err := s.ReportTelemetry(ctx, events); err != nil {
		s.telemetry.putBack(events)
		return err
	}
	return nil
}

// WatchTelemetry flushes the queue until ctx ends.
func (s *Server) WatchTelemetry(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			flushCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			if err := s.FlushTelemetry(flushCtx); err != nil {
				log.Printf("telemetry report failed: %v", err)
			}
			cancel()
		}
	}
}

// EndSessions closes the telemetry of every live connection before the service stops, so the
// last batch carries their durations even though the sockets close after it is sent. Call it
// before closing the rooms, which drop the connections.
func (s *Server) EndSessions(reason string) {
	s.mu.Lock()
	sessions := make([]*liveSession, 0, len(s.sessions))
	for _, session := range s.sessions {
		sessions = append(sessions, session)
	}
	s.mu.Unlock()
	for _, session := range sessions {
		s.sessionEnded(session, reason)
	}
}
