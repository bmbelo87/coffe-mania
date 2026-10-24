# Segurança: rotas e proteções

Auditoria da fase A4, em 24/10/2026. Vale para o PocketBase (`database/`), o servidor do jogo (`game-server/`) e o proxy (`deploy/Caddyfile`). Quando surgir uma rota nova, siga as regras da seção "Ao criar uma rota" no fim.

## Camadas

| Camada | O que faz | Onde |
| --- | --- | --- |
| Cloudflare | DDoS de rede e de HTTP, cache dos assets com hash, IP real em `CF-Connecting-IP` | Painel da Cloudflare |
| Caddy | HTTPS. Aceita só a Cloudflare (firewall). Bloqueia `/_/`, as APIs genéricas do PocketBase e `/api/coffe/game-internal/`. Repassa o IP real em `X-Real-IP` | `deploy/Caddyfile` |
| Limite por sessão | 60 pedidos de uma vez e 6 por segundo em `/api/coffe/*` e `/api/realtime`, por cookie de sessão | `database/ratelimit.go` |
| Limite anônimo | 200 de uma vez e 20 por segundo por IP, sem sessão. É folgado porque operadoras móveis põem muita gente atrás do mesmo IP | `database/ratelimit.go` |
| Limites por rota | Login 20/min; lista de espera 5/min; convite 20/min; cadastro 10/min; senha 5/min; conta 10/min, por IP | Regras do PocketBase (migrações) |
| Desafio no login | Da 5ª senha errada em 30 min, aquela conta exige o Turnstile a cada tentativa. Sem bloqueio total, para ninguém conseguir trancar a conta dos outros | `database/ratelimit.go`, `session.go` |
| Origem | Toda mutação exige `Origin` igual ao host. Junto com o cookie `SameSite=Lax`, isso fecha o CSRF | `sameOrigin` em `session.go` |
| Cabeçalhos da página | CSP sem `unsafe-eval` (o Pixi usa `pixi.js/unsafe-eval`), `frame-ancestors 'none'`, `nosniff`, `X-Frame-Options`, `Referrer-Policy`. HSTS fica no Caddy | `setPageHeaders` em `main.go` |
| WebSocket | Ticket assinado de 1 minuto e uso único; versão do cliente conferida; uma conexão por conta; até 20 conexões abertas e 30 tentativas seguidas por IP; 10 comandos/s por conexão; mensagens de até 8 KB | `game-server/gameruntime/http.go` |
| Servidor autoritativo | Toda ação de jogo é validada no servidor: dono do quarto, recursos, posição, tempos. Cada operação tem `requestId`, então um reenvio não aplica duas vezes | rotas de cada sistema |
| Contas | Papéis; suspensão e troca de senha invalidam todos os tokens; ferramentas de dev só para a equipe e nunca em produção | `accounts.go`, `production.go` |

## Rotas do PocketBase

Legenda:
- **Sessão:** a rota exige o cookie de sessão.
- **Origem:** a mutação exige `Origin` igual ao host.
- **Limite:** o tamanho máximo do corpo do pedido.
- **Repetição:** o que acontece quando o mesmo pedido chega duas vezes.
- **Rota:** a regra própria de limite daquela rota, além do limite geral por sessão ou por IP.

| Rota | Sessão | Origem | Limite | Repetição | Rota |
| --- | --- | --- | --- | --- | --- |
| `GET /api/coffe/session`, `/status`, `/access/config` | — | — | — | leitura | — |
| `POST /api/coffe/session/login` | — | sim | 4 KB | — | 20/min + desafio |
| `POST /session/logout`, `/session/logout-all` | sim | sim | — | idempotente | — |
| `POST /api/coffe/waitlist`, `/waitlist/confirm` | — | sim | 4 KB / 1 KB | resposta igual; link de uso único | 5/min, 10/min |
| `POST /api/coffe/invite/check`, `/signup` | — | sim | 1 KB / 4 KB | o convite é gasto numa transação | 20/min, 10/min |
| `POST /api/coffe/password/forgot`, `/password/reset` | — | sim | 4 KB | o link vale uma vez | 5/min |
| `/api/coffe/account/*` (senha, exportar, excluir) | sim | sim | 4 KB / 1 KB | — | 10/min |
| `POST /api/coffe/admin/*` | admin | sim | 2 KB | estado final | — |
| `GET /api/coffe/player-state`, `/room`, `/cooking`, `/juices`, `/supplies`, `/waiters`, `/npc-appearance` | sim | — | — | leitura | — |
| `POST /api/coffe/room/*` (comprar, mover, guardar, vender, expandir) | sim, dono | sim | 2 KB | `requestId` | — |
| `POST /api/coffe/cooking/*`, `/cooking/spices/purchase` | sim, dono | sim | 1 KB | `requestId` | — |
| `POST /api/coffe/juices/*`, `/supplies/*`, `/waiters/hire` | sim, dono | sim | 1–2 KB | `requestId` | — |
| `POST /api/coffe/cafe-name`, `/level-ups/ack`, `/appearance` | sim | sim | 1–8 KB | estado final | — |
| `POST /api/coffe/game-ticket` | sim | sim | 1 KB | ticket novo, de uso único | — |
| `POST /api/realtime` (assinatura SSE) | sim | sim | — | — | — |
| `/api/coffe/dev/*` | equipe e servidor com dev | sim | 2 KB | recibo por `requestId` | — |
| `/api/coffe/game-internal/*` | chave secreta | — | 4–128 KB | `requestId` / estado | sem limite; bloqueada no Caddy |

O limite geral por sessão ou por IP vale para todas as rotas acima, menos as internas.

## Achados e correções desta auditoria

- **Ponte interna limitada por engano.** Sob carga, o servidor do jogo recebia 429 do PocketBase nas chamadas internas: todas saem de 127.0.0.1 e caíam na regra padrão "/api/" (300 a cada 10 s). Entradas em quartos falhavam e refeições deixariam de ser registradas. Corrigido pela migração `202610250003_internal_rate_limit`.
- **Origem.** Algumas mutações aceitavam pedidos sem `Origin`. Agora toda mutação exige o cabeçalho.
- **Limites.** Não havia limite por conta nas rotas do jogo; agora há o limite por sessão e o anônimo por IP. Também não havia limite de conexões WebSocket por IP; agora há.
- **Senha.** Não havia defesa contra tentativas de senha numa mesma conta; agora há o desafio do Turnstile.
- **Página.** Não havia CSP. A página agora roda sem `eval`.
- **Dependências:**
  - Go 1.27.0 com 13 vulnerabilidades conhecidas na biblioteca padrão (http2, net/http, TLS, x509, html/template): `go.mod` pede o toolchain 1.27.3;
  - `golang.org/x/net` foi para a v0.60.0;
  - npm: `@xmldom/xmldom` (usado pelo Pixi) recebeu correção de patch e o Vite foi para 7.3.7 (só no modo dev).

  `govulncheck` e `npm audit` ficam limpos.

## Ao criar uma rota

1. Leitura de dados do jogador: `sessionRecord(r)`. Nunca aceite o id do jogador vindo do navegador.
2. Mutação: `.Bind(apis.BodyLimit(...)).BindFunc(sameOrigin)`, `requestId` para o que gasta recursos, e validação completa no servidor.
3. Rota pública (sem sessão): adicione uma regra de limite por IP numa migração e, se for um formulário, Turnstile.
4. Nada de segredos em query string: links de email levam o segredo depois do `#`.
5. Rodar `govulncheck ./database/... ./game-server/... ./shared/...` e `npm audit` antes de cada release.
