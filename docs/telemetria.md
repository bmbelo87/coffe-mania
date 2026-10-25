# Telemetria do alpha

A telemetria é própria. Nada vai para serviços de terceiros, e o que ela coleta é o que a Política de Privacidade (`game/src/auth/legal.ts`) descreve: métricas de uso, erros e registros técnicos, com os eventos detalhados guardados por até 90 dias. O painel fica em **`/admin/metricas`** e só abre para contas com o papel `admin`.

## Onde os dados ficam

As tabelas ficam no `auxiliary.db` do PocketBase, separado do `data.db` do jogo. As gravações saem em lotes a cada 5 s, então a telemetria não disputa a escrita com as transações do jogo. Se a fila passar de 20 mil itens, os novos são descartados, e o painel mostra quantos.

| Tabela | Conteúdo | Guarda |
| --- | --- | --- |
| `telemetry_events` | Eventos do servidor, do servidor do jogo e do cliente | 90 dias |
| `telemetry_ledger` | Extrato: cada mudança de caféGranas, caféOuros, XP e nível, com o motivo | 90 dias |
| `telemetry_activity` | Dias em que cada conta jogou (ativos por dia e retenção) | Para sempre |
| `telemetry_milestones` | Primeira vez de cada marco do funil | Para sempre |
| `telemetry_daily` | Resumos por dia: contagens, percentis, extrato por motivo | Para sempre |

**Rotina diária** (`database/telemetry_report.go`):
- roda às 00:10 de Brasília e também ao ligar o servidor;
- resume os dias completos e só então apaga os eventos brutos com mais de 90 dias;
- os dias do painel seguem o horário de Brasília (UTC−3).

**Contas excluídas:** quando uma conta é excluída, todas as linhas dela saem das tabelas; os resumos diários não têm id de conta. A exportação de dados da conta (LGPD) inclui os eventos, o extrato e os dias ativos.

## O que é coletado

Toda linha leva o id da conta (quando há) e, no cliente, um id aleatório por página aberta. IP e dados do navegador não entram na telemetria.

**Servidor** (`database/`):
- **Acesso:**
  - `waitlist_join` (entrada nova na lista);
  - `waitlist_confirm`;
  - `invite_sent` (origem e onda);
  - `signup` (onda);
  - `login`;
  - `password_reset`.
- **Jogo:**
  - `cafe_named` (primeiro nome ou troca);
  - `waiter_hired`;
  - `customer_unhappy` (cliente que foi embora sem comer);
  - `level_up`.
- **Extrato da economia:** um gancho em `player_state` registra toda mudança de saldo, venha de onde vier: rotas do jogo, servidor do jogo, ferramentas de dev ou o painel do PocketBase.

**Servidor do jogo** (`game-server/gameruntime/telemetry.go`): `session_start` (próprio café ou visita) e `session_end` (duração e motivo). Saem em lotes a cada 10 s, e o último lote sai no encerramento. Os motivos de fim são:

| Motivo | Quando |
| --- | --- |
| `left` | Saiu |
| `lost` | Conexão perdida |
| `replaced` | Abriu outra janela |
| `maintenance` | Manutenção |
| `kicked` | Suspensão ou exclusão da conta |
| `flood` | Comandos demais |
| `invalid` | Comando inválido |
| `shutdown` | Atualização do servidor |

**Cliente** (`game/src/core/telemetry.ts`). Vale uma lista fechada; o servidor descarta o resto (`acceptClientEvent`). Os lotes saem a cada 30 s e ao esconder a página.

| Evento | Conteúdo |
| --- | --- |
| `load` | Milissegundos até o café aparecer |
| `fps` | Média de um minuto com a aba visível |
| `js_error` | Mensagem e caminho do script, sem endereço nem parâmetros. No máximo 20 por página e 3 por mensagem |
| `disconnect` | Código de fechamento do WebSocket |
| `screen` | Cozinha, temperos, garçons, guarda-roupa, loja, encomendas, sucos, convite, configurações ou expansão |

A cada 5 minutos o PocketBase também guarda quantos jogadores e cafés estão online (`online`), lendo `/internal/metrics` do servidor do jogo.

## Extrato da economia

Antes de salvar, quem muda um saldo marca o motivo com `tagLedger(state, motivo, referência)`. A marca fica só na memória do registro e nunca vai para o banco. O gancho em `database/telemetry.go`:
- compara com a gravação anterior, então um registro salvo duas vezes na mesma transação não conta em dobro;
- só enfileira depois do commit;
- separa o prêmio de nível (`nivel`) do ganho da ação.

Uma mudança sem marca aparece como **"outro"** no painel. Assim, uma rota nova que esqueça a marca aparece no painel em vez de sumir.

| Motivo | Referência |
| --- | --- |
| `cozinhar` | Receita |
| `cliente` | Receita (prato servido) |
| `nivel` | Nível alcançado |
| `loja` / `venda` | Item |
| `expansao` | Forma de pagamento |
| `suco` | Receita de suco servido |
| `suco_destravar` | — |
| `recarga_energia` | — |
| `encomenda` | Tipo de encomenda |
| `encomenda_pressa` | Tipo de encomenda |
| `encomenda_salvar` | Tipo de encomenda |
| `tempero` | Tempero |
| `dev` | Recurso alterado pela ferramenta de dev |

Para auditar uma conta suspeita, consulte o extrato dela no `auxiliary.db` pelo túnel SSH:

```sql
SELECT datetime(at / 1000, 'unixepoch', '-3 hours') AS quando, currency, delta, balance, reason, ref
FROM telemetry_ledger WHERE user_id = 'ID_DA_CONTA' ORDER BY at DESC LIMIT 200;
```

Saldo que cresce com motivo `outro`, ou ganhos muito acima do que as receitas pagam, merece investigação.

## O painel

Filtros de 7, 30 ou 90 dias. Por padrão, as contas `admin` ficam fora dos números de jogadores (ativos, retenção e funil); a opção "Incluir contas da equipe" as traz de volta. Os resumos de eventos e da economia incluem todos, e as ferramentas de dev aparecem como motivo próprio.

O painel tem estas seções:
- **Agora:** jogadores e cafés online, tempo do passo de simulação (p95 e p99) e jogadores online nas últimas 24 h.
- **Jogadores:**
  - ativos no dia, em 7 e em 30 dias;
  - contas novas;
  - sessões por dia, contadas como sessões de jogo: conexões do mesmo jogador com menos de 5 minutos entre elas viram uma sessão só.
- **Retenção por onda:** das contas criadas há pelo menos N dias, quantas jogaram no dia N (1, 7 e 30).
- **Funil desde o início:**
  1. convidados;
  2. contas;
  3. nome do café;
  4. primeiro prato;
  5. primeiro cliente servido;
  6. nível 2;
  7. nível 5.

  Os marcos de cozinhar e servir contam a partir da ativação da telemetria; os demais vêm do banco do jogo.
- **Uso:** telas abertas, receitas cozidas, itens comprados, encomendas, sucos, temperos e expansões.
- **Economia:** caféOuros ganhos e gastos por dia, e a tabela de motivos.
- **Saúde:** carregamento, FPS, erros de JavaScript, desconexões e como as sessões terminaram.
- **Lista de espera:** inscritos por situação.

Cada gráfico tem uma tabela em "Ver tabela".

## Monitor externo

Fica fora do servidor e depende de uma conta sua (UptimeRobot, Better Stack ou parecido, com alerta por email). Configure dois monitores HTTP, a cada 5 minutos:
- `https://SEU-DOMINIO/api/health` (PocketBase);
- `https://SEU-DOMINIO/game/health` (servidor do jogo, pelo proxy do PocketBase).

## Ao criar uma feature

1. Mudou saldo: chame `tagLedger` antes de salvar o `player_state`.
2. Evento novo do servidor: use `trackEvent(app, conta, nome, rótulo, props)` depois que a ação deu certo. Não chame dentro da transação.
3. Evento novo do cliente:
   1. acrescente o evento em `acceptClientEvent` e em `telemetry.ts`;
   2. descreva o evento nesta página;
   3. se ele coletar algo novo, confira a Política de Privacidade.
