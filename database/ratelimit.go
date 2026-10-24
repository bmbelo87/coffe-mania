package main

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// tokenBuckets is an in-memory rate limiter (one PocketBase process serves the game). A key
// starts with a full bucket of burst tokens and earns rate tokens per second.
type tokenBuckets struct {
	mu      sync.Mutex
	rate    float64
	burst   float64
	buckets map[string]*tokenBucket
	pruned  time.Time
}

type tokenBucket struct {
	tokens float64
	last   time.Time
}

func newTokenBuckets(rate, burst float64) *tokenBuckets {
	return &tokenBuckets{rate: rate, burst: burst, buckets: map[string]*tokenBucket{}}
}

func (l *tokenBuckets) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	// Full buckets carry no information; dropping them keeps memory bounded.
	if now.Sub(l.pruned) > time.Minute {
		l.pruned = now
		for k, b := range l.buckets {
			if b.tokens+now.Sub(b.last).Seconds()*l.rate >= l.burst {
				delete(l.buckets, k)
			}
		}
	}
	b := l.buckets[key]
	if b == nil {
		b = &tokenBucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}
	b.tokens = min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.rate)
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// Limits for /api/coffe: a session gets a burst of 60 and 6 requests per second sustained,
// far above what clicking allows; anonymous traffic is counted per IP, more loosely because
// mobile carriers put many people behind one address. The stricter per-route rules for
// login and the access pages are PocketBase rate limits (migrations).
var (
	sessionLimiter   = newTokenBuckets(6, 60)
	anonymousLimiter = newTokenBuckets(20, 200)
)

func limiterKey(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:12])
}

// rateLimitGame runs before every route. The session cookie is the key when present (no
// database lookup: an invalid cookie is refused by the route itself).
func rateLimitGame(r *core.RequestEvent) error {
	path := r.Request.URL.Path
	if !strings.HasPrefix(path, "/api/coffe/") && path != "/api/realtime" || strings.HasPrefix(path, "/api/coffe/game-internal/") {
		return r.Next()
	}
	now := time.Now()
	allowed := false
	if cookie, err := r.Request.Cookie(sessionCookie); err == nil && cookie.Value != "" {
		allowed = sessionLimiter.allow("s:"+limiterKey(cookie.Value), now)
	} else {
		allowed = anonymousLimiter.allow("ip:"+r.RealIP(), now)
	}
	if !allowed {
		r.Response.Header().Set("Retry-After", "5")
		return r.JSON(http.StatusTooManyRequests, map[string]any{
			"status": http.StatusTooManyRequests, "message": "Muitas ações seguidas. Espere alguns segundos e tente de novo.",
		})
	}
	return r.Next()
}

// loginGuard counts wrong passwords per account. From the fifth failure in 30 minutes the
// account asks for the anti-bot check on every attempt: guessing becomes expensive, while
// the owner can still sign in (a hard lock would let anyone lock others out).
type loginGuard struct {
	mu       sync.Mutex
	failures map[string]loginFailures
}

type loginFailures struct {
	count int
	first time.Time
}

const (
	loginFailureWindow = 30 * time.Minute
	loginFreeAttempts  = 5
)

var accountLogins = &loginGuard{failures: map[string]loginFailures{}}

func (g *loginGuard) needsChallenge(email string, now time.Time) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	entry, ok := g.failures[email]
	if ok && now.Sub(entry.first) > loginFailureWindow {
		delete(g.failures, email)
		return false
	}
	return ok && entry.count >= loginFreeAttempts
}

func (g *loginGuard) fail(email string, now time.Time) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if len(g.failures) > 50000 {
		for key, entry := range g.failures {
			if now.Sub(entry.first) > loginFailureWindow {
				delete(g.failures, key)
			}
		}
	}
	entry := g.failures[email]
	if entry.count == 0 || now.Sub(entry.first) > loginFailureWindow {
		entry = loginFailures{first: now}
	}
	entry.count++
	g.failures[email] = entry
}

func (g *loginGuard) succeed(email string) {
	g.mu.Lock()
	delete(g.failures, email)
	g.mu.Unlock()
}
