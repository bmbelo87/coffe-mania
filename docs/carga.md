# Teste de carga

## Como rodar

`tools/loadtest` simula jogadores reais. Cada robô:
- tem a própria conta e o próprio IP;
- entra pelo login, pede o ticket e abre o quarto pelo WebSocket;
- anda pelo café a cada 3–6 s;
- consulta o estado do jogador a cada 30 s.

20% dos robôs visitam o café de outro. No fim, o programa imprime as latências vistas pelos robôs e a métrica do servidor do jogo (`/internal/metrics`, com o tempo de cada passo de simulação e de cada tarefa dos quartos).

O teste roda só num servidor de teste, nunca no de produção: ele cria contas `bot-NNN@load.test` pelo superusuário. Os serviços precisam de `COFFE_TRUSTED_PROXY_HEADER=X-Real-IP`, para os robôs chegarem com IPs diferentes, como jogadores de verdade.

```sh
go build -o .runtime/bin/loadtest ./tools/loadtest
.runtime/bin/loadtest -bots 300 -ramp 60s -hold 180s -superuser EMAIL:SENHA -secret-file CAMINHO/game-secret
```

## Resultado de 24/10/2026

Ambiente:
- uma máquina Windows com 16 núcleos rodando tudo junto: PocketBase, servidor do jogo e os 300 robôs;
- build de produção servido pelo PocketBase;
- 300 robôs entrando em 60 s e mantidos por 180 s;
- cerca de 240 quartos ativos, com clientes NPC chegando, comendo e indo embora.

| Medida | p50 | p95 | p99 | Máx |
| --- | --- | --- | --- | --- |
| Comando no quarto (13.832 caminhadas) | < 1 ms | 1 ms | 1 ms | 1,8 s |
| Passo de simulação de um quarto (319 mil) | 0,5 ms | 1 ms | 4 ms | 149 ms |
| Tarefa do quarto (entrada, comando) | < 1 ms | 1 ms | 1 ms | 41 ms |
| Estado do jogador (HTTP) | 2 ms | 2 ms | 4 ms | 251 ms |
| Login | 96 ms | 113 ms | 143 ms | 255 ms |
| Entrada no quarto (ticket + WebSocket + carga do café) | 163 ms | 1,4 s | 3,4 s | 3,9 s |

| Recurso | Média | Pico |
| --- | --- | --- |
| PocketBase | 0,6 núcleo, 105 MB | 6,4 núcleos (hash de senha dos 300 logins na subida) |
| Servidor do jogo | 0,3 núcleo, 66 MB | 0,6 núcleo |
| Tráfego para cada jogador | 2,4 KB/s, 5,8 mensagens/s | — |

Nenhum erro além das caminhadas recusadas: os robôs sorteiam destinos sobre mesas e paredes, e o servidor recusa, como deve.

### O que a medição mostrou

- **Corrigido:** na primeira rodada, 18 entradas falharam porque a ponte interna levava 429 do PocketBase (detalhes em [segurança](seguranca.md)).
- **A entrada no quarto é a parte mais lenta.**
  - Sem concorrência, carregar um café leva cerca de 20 ms. Os maiores pedaços são os candidatos a garçom (5 ms), a política de aparência dos NPCs (4 ms) e os rostos (3 ms).
  - Com 300 entradas em 60 s na mesma máquina dos robôs, a fila de escrita do SQLite e a CPU dividida levam a cauda a 1–4 s.
  - Num alpha, as entradas se espalham ao longo do dia. Se a cauda incomodar, o próximo passo é guardar em cache a política dos NPCs e os candidatos.
- **Escritas que mais pesam:** as frequentes são a saída de clientes (cerca de 25/s, porque os robôs não servem ninguém) e a presença dos quartos (16/s). Com p50 de 0,5 a 1,6 ms, o SQLite em WAL comporta bem esse volume.

### Tamanho do servidor

300 jogadores ao mesmo tempo usam menos de um núcleo e cerca de 200 MB somando os dois serviços.
- **Mínimo para o alpha:** 2 vCPU e 4 GB, que deixam folga para os picos de login e para o backup.
- **Confortável:** 4 vCPU e 8 GB.

O que mais pesa é a subida rápida de logins (hash de senha), não o jogo em si.

## Limites do teste

- Os robôs não cozinham, não compram e não abrem a conexão SSE do estado do jogador. As rotas de economia foram medidas só pela consulta de estado e pelas operações internas dos NPCs.
- Rodou numa máquina só, sem a rede real, sem a Cloudflare e sem o Caddy. A latência de rede até São Paulo soma-se às medidas.
- É uma medida de capacidade, não de estabilidade longa: um teste de várias horas fica para antes da segunda onda.
