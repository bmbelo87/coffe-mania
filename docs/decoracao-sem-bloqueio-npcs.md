# Decoração sem bloqueio por NPCs — 25/10/2026

Implementado: clientes e garçons deixam de vetar a seleção e a colocação de itens, inclusive quando ocupam a posição atual, a origem ou o destino de um passo. Mesas e cadeiras usadas por clientes podem ser movidas, giradas, guardadas ou vendidas. A geometria do quarto, a colisão entre móveis, a posse, os preços e as transações do inventário continuam sendo validados. A proteção de outros jogadores humanos permanece.

## Ações e refeições

Selecionar uma mesa apenas reserva sua edição; cancelar não remove clientes nem movimenta refeições. O comando mantém a autorização do dono e funciona mesmo quando o chef está ocupado. O tratamento novo só começa depois que a persistência aceita a alteração e fornece o mundo atualizado.

- Cliente comendo ou bebendo: continua no ponto original com a mesma ação, refeição e prazo. As reservas da cadeira/mesa são liberadas imediatamente. Depois de terminar, segue para a saída, sem pedir outro serviço e sem penalidade de satisfação.
- Cliente esperando ou indo até um móvel alterado: abandona esse destino e segue para a saída. Um passo em andamento termina com a calibração atual de troca lógica na metade do passo.
- Garçom com entrega reservada para esse cliente: libera a reserva e procura outro serviço; uma porção só é consumida quando a entrega é efetivada, conforme a regra existente.
- Cliente com saída totalmente fechada pela decoração: após encerrar a ação, a rotina de saída o libera sem reter móveis ou gerar penalidade. Sem porta disponível, é removido ao concluir a ação.

Uma refeição já servida termina normalmente: não há nova cobrança, devolução duplicada nem supressão antecipada do prato. A rotina transacional anterior de devolução em `decoration.go` foi preservada e continua coberta pelos testes. O novo fluxo é aditivo, em `decoration_actions.go`, e não usa aquela devolução para uma refeição que o cliente vai terminar. Essa regra substitui, na seleção comum de mesas, o comportamento anterior de remoção imediata do cliente com devolução do prato.

## Posição e sincronização

O servidor conserva uma cópia da cadeira e da mesa originais em `detachedChair` e `detachedTable`, além de `decorationExit`. O cliente usa esses apoios para o quadril, a profundidade e o prato até o fim da ação. A posição não acompanha o móvel movido. Nenhuma cadeira ou mesa fantasma é desenhada. Os campos opcionais seguem nas mensagens de atores e no salvamento de dormência; uma atualização posterior sem esses apoios limpa os campos no cliente.

A simulação continua na fila compartilhada do Go. Não foram adicionadas gravações por passo/frame, mudança na interpolação ou alteração na transição lógica do movimento. Não há assets novos. A separação entre postura visual e posição lógica segue a referência técnica de [AvatarVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/master/src/nitro/room/object/visualization/avatar/AvatarVisualization.ts); as coordenadas e as regras são próprias deste runtime.

## Verificação

- `go test ./game-server/gameruntime -run '^TestDecoration' -count=1`: seleção/cancelamento, refeições preservadas, mover/guardar/vender, colocação sobre NPC em movimento, garçons, ocupação humana, dono/visitante, persistência recusada, fim do prazo e bebida/dormência. Inclui as regressões do fluxo transacional anterior de devolução.
- Regressões relacionadas de passo diagonal, encontro entre clientes, entrega comum, garçom preso e invalidação de pedidos na dormência passaram junto com as de decoração.
- `node --test tests/unit/decoration.test.mjs tests/unit/decoration-npc-usage.test.mjs`: oito testes. Os quatro anteriores preservam fechamento da porta, confirmação única, cancelamento e falha da seleção; os quatro novos cobrem ocupação nas duas pontas do passo, pegada rotacionada, apoio antigo após mover e restauração/limpeza dos campos no cliente de tempo real com transporte simulado. O bundle Node da fixture recebeu uma URL-base explícita, sem requisições reais.
- `npm run typecheck`: passou.

Os testes usam estado em memória e armazenamento simulado. Não foram iniciados servidores HTTP/WebSocket ou banco, nem alterados dados de uma conta. Não foi feita uma sessão multiplayer visual ao vivo. Os dois serviços Go e a página precisam usar os fontes atualizados na próxima inicialização. E02/E03 mantêm o andamento anterior.
