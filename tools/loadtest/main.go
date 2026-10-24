// Teste de carga: N jogadores simulados entram, abrem o quarto pelo WebSocket, andam pelo
// café e consultam o estado do jogador, como um cliente real. Só para servidores de teste:
// cria contas bot-NNN@load.test pelo superusuário. Uso e resultados: docs/carga.md.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"math/rand/v2"
	"net/http"
	"net/http/cookiejar"
	"os"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"coffe-mania/shared/buildinfo"

	"github.com/coder/websocket"
	"github.com/google/uuid"
)

var (
	base       = flag.String("base", "http://127.0.0.1:18090", "PocketBase (API do jogo)")
	gameWS     = flag.String("ws", "ws://127.0.0.1:18091/game/ws", "WebSocket do servidor do jogo")
	gameHTTP   = flag.String("game", "http://127.0.0.1:18091", "servidor do jogo, para /internal/metrics")
	secretFile = flag.String("secret-file", "", "chave compartilhada (para ler /internal/metrics)")
	superuser  = flag.String("superuser", "", "email:senha do superusuário, para criar as contas dos robôs")
	bots       = flag.Int("bots", 100, "jogadores simulados")
	ramp       = flag.Duration("ramp", time.Minute, "tempo para todos entrarem")
	hold       = flag.Duration("hold", 3*time.Minute, "tempo com todos conectados")
	visitShare = flag.Float64("visit", .2, "fração dos robôs que visita o café de outro em vez do próprio")
)

type stats struct {
	mu        sync.Mutex
	latencies map[string][]time.Duration
	errors    map[string]int
	messages  atomic.Int64
	bytes     atomic.Int64
	connected atomic.Int64
}

func (s *stats) observe(kind string, d time.Duration) {
	s.mu.Lock()
	s.latencies[kind] = append(s.latencies[kind], d)
	s.mu.Unlock()
}

func (s *stats) fail(kind string) {
	s.mu.Lock()
	s.errors[kind]++
	s.mu.Unlock()
}

func percentile(values []time.Duration, p float64) time.Duration {
	if len(values) == 0 {
		return 0
	}
	sorted := slices.Clone(values)
	slices.Sort(sorted)
	return sorted[min(len(sorted)-1, int(p*float64(len(sorted))))]
}

type bot struct {
	index  int
	ip     string
	email  string
	client *http.Client
	id     string
}

func (b *bot) request(ctx context.Context, method, path string, body any, out any) (int, error) {
	var reader io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, *base+path, reader)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", *base)
	// Each robot has its own address, as real players do (the per-IP limits stay realistic).
	req.Header.Set("X-Real-IP", b.ip)
	res, err := b.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()
	if out != nil && res.StatusCode < 300 {
		return res.StatusCode, json.NewDecoder(res.Body).Decode(out)
	}
	_, _ = io.Copy(io.Discard, res.Body)
	return res.StatusCode, nil
}

func superuserToken() string {
	email, password, ok := strings.Cut(*superuser, ":")
	if !ok {
		log.Fatal("-superuser email:senha é obrigatório")
	}
	data, _ := json.Marshal(map[string]string{"identity": email, "password": password})
	res, err := http.Post(*base+"/api/collections/_superusers/auth-with-password", "application/json", bytes.NewReader(data))
	if err != nil {
		log.Fatal(err)
	}
	defer res.Body.Close()
	var out struct{ Token string }
	if json.NewDecoder(res.Body).Decode(&out) != nil || out.Token == "" {
		log.Fatalf("superusuário recusado: HTTP %d", res.StatusCode)
	}
	return out.Token
}

func ensureAccounts(token string, count int) {
	var wg sync.WaitGroup
	limit := make(chan struct{}, 8)
	for i := range count {
		wg.Add(1)
		limit <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-limit }()
			data, _ := json.Marshal(map[string]any{
				"email": botEmail(i), "password": botPassword(i), "passwordConfirm": botPassword(i), "name": fmt.Sprintf("Robô %03d", i),
				"verified": true, "role": "player",
			})
			req, _ := http.NewRequest("POST", *base+"/api/collections/users/records", bytes.NewReader(data))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", token)
			if res, err := http.DefaultClient.Do(req); err == nil {
				res.Body.Close() // 400 when the account already exists from an earlier run.
			}
		}()
	}
	wg.Wait()
}

func botEmail(i int) string    { return fmt.Sprintf("bot-%03d@load.test", i) }
func botPassword(i int) string { return fmt.Sprintf("robo-de-carga-%03d", i) }

func (b *bot) run(ctx context.Context, rooms *sync.Map, st *stats) {
	started := time.Now()
	var session struct {
		PlayerID string `json:"playerId"`
	}
	status, err := b.request(ctx, "POST", "/api/coffe/session/login", map[string]string{"email": b.email, "password": botPassword(b.index)}, &session)
	if err != nil || status != 200 {
		st.fail(fmt.Sprintf("login HTTP %d", status))
		return
	}
	st.observe("login", time.Since(started))
	b.id = session.PlayerID
	rooms.Store(b.index, b.id)

	room := b.id
	if rand.Float64() < *visitShare {
		// Visit a robot that already entered: two humans in the same café.
		if other, ok := rooms.Load(rand.IntN(max(1, b.index))); ok {
			room = other.(string)
		}
	}
	for ctx.Err() == nil {
		b.session(ctx, room, st)
		select {
		case <-ctx.Done():
		case <-time.After(2 * time.Second):
		}
	}
}

// session is one WebSocket connection; it returns when the connection ends.
func (b *bot) session(ctx context.Context, room string, st *stats) {
	started := time.Now()
	var ticket struct {
		Ticket string `json:"ticket"`
	}
	status, err := b.request(ctx, "POST", "/api/coffe/game-ticket", map[string]string{"roomId": room}, &ticket)
	if err != nil || status != 200 {
		st.fail(fmt.Sprintf("ticket HTTP %d", status))
		return
	}
	header := http.Header{}
	header.Set("X-Real-IP", b.ip)
	conn, _, err := websocket.Dial(ctx, *gameWS, &websocket.DialOptions{HTTPHeader: header})
	if err != nil {
		st.fail("ws dial")
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(4 << 20)
	join, _ := json.Marshal(map[string]string{"type": "join", "ticket": ticket.Ticket, "version": buildinfo.Version})
	if conn.Write(ctx, websocket.MessageText, join) != nil {
		st.fail("ws join")
		return
	}
	st.connected.Add(1)
	defer st.connected.Add(-1)

	pending := sync.Map{}
	world := struct{ x, y atomic.Int64 }{}
	world.x.Store(6)
	world.y.Store(6)
	welcomed := make(chan struct{})
	go func() {
		var once sync.Once
		for {
			_, data, err := conn.Read(ctx)
			if err != nil {
				var closed websocket.CloseError
				if ctx.Err() == nil {
					if errors.As(err, &closed) {
						st.fail(fmt.Sprintf("ws fechado %d", closed.Code))
					} else {
						st.fail("ws leitura")
					}
				}
				conn.CloseNow()
				return
			}
			st.messages.Add(1)
			st.bytes.Add(int64(len(data)))
			var event struct {
				Type      string `json:"type"`
				RequestID string `json:"requestId"`
				World     *struct {
					TilesX int `json:"tilesX"`
					TilesY int `json:"tilesY"`
				} `json:"world"`
			}
			if json.Unmarshal(data, &event) != nil {
				continue
			}
			if event.Type == "welcome" {
				if event.World != nil {
					world.x.Store(int64(event.World.TilesX))
					world.y.Store(int64(event.World.TilesY))
				}
				once.Do(func() { st.observe("entrada", time.Since(started)); close(welcomed) })
			}
			if event.RequestID != "" {
				if sent, ok := pending.LoadAndDelete(event.RequestID); ok {
					st.observe("comando", time.Since(sent.(time.Time)))
					if event.Type == "error" {
						st.fail("comando recusado")
					}
				}
			}
		}
	}()
	select {
	case <-welcomed:
	case <-time.After(15 * time.Second):
		st.fail("sem welcome")
		return
	case <-ctx.Done():
		return
	}
	nextState := time.Now().Add(time.Duration(rand.IntN(30)) * time.Second)
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Duration(3000+rand.IntN(3000)) * time.Millisecond):
		}
		id := uuid.NewString()
		walk, _ := json.Marshal(map[string]any{"type": "walk", "requestId": id, "tx": 1 + rand.IntN(int(max(1, world.x.Load()-2))), "ty": 1 + rand.IntN(int(max(1, world.y.Load()-2)))})
		pending.Store(id, time.Now())
		writeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := conn.Write(writeCtx, websocket.MessageText, walk)
		cancel()
		if err != nil {
			return
		}
		if time.Now().After(nextState) {
			nextState = time.Now().Add(30 * time.Second)
			sent := time.Now()
			if status, err := b.request(ctx, "GET", "/api/coffe/player-state", nil, nil); err != nil || status != 200 {
				st.fail(fmt.Sprintf("player-state HTTP %d", status))
			} else {
				st.observe("player-state", time.Since(sent))
			}
		}
	}
}

func metrics(reset bool) map[string]any {
	if *secretFile == "" {
		return nil
	}
	secret, err := os.ReadFile(*secretFile)
	if err != nil {
		return nil
	}
	url := *gameHTTP + "/internal/metrics"
	if reset {
		url += "?reset=1"
	}
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(string(secret)))
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil
	}
	defer res.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(res.Body).Decode(&out)
	return out
}

func main() {
	flag.Parse()
	log.Printf("Criando/conferindo %d contas de robôs…", *bots)
	ensureAccounts(superuserToken(), *bots)
	st := &stats{latencies: map[string][]time.Duration{}, errors: map[string]int{}}
	ctx, cancel := context.WithTimeout(context.Background(), *ramp+*hold)
	defer cancel()
	rooms := &sync.Map{}
	var wg sync.WaitGroup
	interval := *ramp / time.Duration(max(1, *bots))
	for i := range *bots {
		jar, _ := cookiejar.New(nil)
		b := &bot{index: i, ip: fmt.Sprintf("10.%d.%d.%d", 20+i/62500, (i/250)%250, 1+i%250), email: botEmail(i),
			client: &http.Client{Jar: jar, Timeout: 15 * time.Second}}
		wg.Add(1)
		go func() { defer wg.Done(); b.run(ctx, rooms, st) }()
		time.Sleep(interval)
	}
	log.Printf("Todos os robôs iniciados; segurando por %s.", *hold)
	_ = metrics(true) // the measurement window starts with everyone connected
	window := time.Now()
	ticker := time.NewTicker(30 * time.Second)
	go func() {
		for range ticker.C {
			log.Printf("conectados %d, mensagens recebidas %d", st.connected.Load(), st.messages.Load())
		}
	}()
	startMessages, startBytes := st.messages.Load(), st.bytes.Load()
	<-ctx.Done()
	ticker.Stop()
	elapsed := time.Since(window).Seconds()
	server := metrics(false)
	wg.Wait()

	fmt.Printf("\n== Carga: %d robôs, %.0f s com todos conectados ==\n", *bots, elapsed)
	st.mu.Lock()
	kinds := make([]string, 0, len(st.latencies))
	for kind := range st.latencies {
		kinds = append(kinds, kind)
	}
	slices.Sort(kinds)
	for _, kind := range kinds {
		values := st.latencies[kind]
		fmt.Printf("%-13s n=%-6d p50=%-8s p95=%-8s p99=%-8s máx=%s\n", kind, len(values),
			percentile(values, .5).Round(time.Millisecond), percentile(values, .95).Round(time.Millisecond),
			percentile(values, .99).Round(time.Millisecond), percentile(values, 1).Round(time.Millisecond))
	}
	fmt.Printf("erros: %v\n", st.errors)
	st.mu.Unlock()
	perBot := float64(st.bytes.Load()-startBytes) / elapsed / float64(max(1, *bots))
	fmt.Printf("tráfego do servidor para cada jogador: %.1f KB/s, %.1f mensagens/s\n", perBot/1024,
		float64(st.messages.Load()-startMessages)/elapsed/float64(max(1, *bots)))
	if server != nil {
		data, _ := json.MarshalIndent(server, "", "  ")
		fmt.Printf("servidor do jogo: %s\n", data)
	}
}
