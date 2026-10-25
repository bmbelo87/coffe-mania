# Resposta imediata

Desde a 0.6.4 o jogo mostra o resultado de uma ação na hora, antes da resposta do servidor. O servidor continua decidindo tudo: a tela mostra a previsão e, quando a resposta chega, adota o estado oficial. Se o servidor recusar, a previsão é desfeita na hora, com o aviso do motivo.

## O que é previsto

| Ação | Na hora | Quando o servidor responde |
| --- | --- | --- |
| Andar | O personagem sai no clique, pelo caminho que o cliente calculou. O mesmo caminho vai junto no comando `walk` | O servidor segue esse caminho se for válido. Senão, calcula o dele, e o personagem desliza até a posição oficial em 200 ms |
| Cozinhar | Ao chegar ao fogão, o prato começa a ser arrumado e o custo sai do ouro | O pedido sai quando o servidor também tem o chef ao lado do fogão. Os horários oficiais substituem os previstos sem refazer o prato |
| Servir, cancelar, limpar | O prato sai do fogão, ou o fogão fica limpo | Uma recusa recarrega os fogões e o prato ou a sujeira volta |
| Comprar, mover, guardar, vender móvel; pintar piso e parede | A peça fica no lugar, sem "Salvando…" | Os pedidos saem em fila, cada um com a revisão devolvida pelo anterior. Uma recusa desfaz só aquela peça |
| Sucos, café, encomendas, temperos | A janela e o saldo mudam | A resposta substitui a previsão; uma recusa restaura o estado anterior |

## Peças

- **`game/src/game/optimistic.ts`:**
  - `PredictedBalance` soma ao saldo do servidor as mudanças ainda não confirmadas. Cada mudança que o estado do servidor mostra abate as previsões pendentes em ordem, então pintar vários tiles nunca conta o mesmo gasto duas vezes.
  - `SerialQueue` manda uma tarefa por vez.
- **`RoomScreen`:**
  - `predictBalance(delta)` mostra a mudança e devolve uma marca;
  - `settleBalance(marca, aceita)` encerra a previsão. Recusada, ela sai na hora; aceita, fica até o estado do servidor mostrar a mudança, com teto de 5 s.
- **`RoomStoreController`:**
  - a sala na tela é `projectRoom(servidor, pendentes)`;
  - peças compradas e ainda não confirmadas têm id `pending:N` e não podem ser pegas até a confirmação;
  - eventos da sala que chegam no meio não mudam as peças com pedido pendente.
- **Caminhada:**
  - `Actor.predictPath` começa a rota na hora, terminando antes o passo em andamento, como o servidor faz;
  - `followClientPath` (servidor) aceita a rota quando cada passo é vizinho, livre e não corta canto bloqueado;
  - a previsão anda pelo relógio real, não pelo tempo do quadro do Pixi, que é limitado.

## Ao criar uma ação

1. Calcule a previsão com o que a tela já sabe. Se não der para prever com segurança (sem espaço, sem saldo, dado que só o servidor tem), não preveja: espere a resposta, como antes.
2. Mudança de saldo: `predictBalance` antes de enviar e `settleBalance` na resposta.
3. Na recusa, restaure o estado anterior e mostre a mensagem do servidor.
4. Nunca trate um snapshot montado com previsões como se viesse do servidor. O saldo só é atualizado por respostas e pelo estado em tempo real.
5. Teste com atraso de rede. Um proxy TCP que segura cada pacote por 75 ms em cada sentido, entre o Vite e o servidor, reproduz uma conexão móvel.
