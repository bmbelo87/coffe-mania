# Fila do chef e empregados

Implementação de 21/10/2026. E02 permanece parcial e E03 continua pendente.

## Fila do chef

Pedidos de cozinhar, limpar e levar um prato ao balcão compartilham uma fila FIFO por sessão do cliente. Cada tarefa captura o fogão e a receita no momento do clique; selecionar outro fogão não muda o destino de pedidos anteriores. O livro de outro fogão pode abrir enquanto o chef trabalha.

O próximo pedido começa depois do preparo/limpeza/transporte do chef, sem esperar os minutos de cozimento. Fogões aguardando usam o mesmo alpha 0,38 do alvo atual. Cliques repetidos não duplicam uma tarefa do mesmo fogão. Um fogão removido antes da execução é descartado da fila. A autorização, o custo, a posição e a ação continuam sendo validados pelo servidor. Não há cobrança antecipada pelos pedidos aguardando.

A fila é uma intenção da interface e não sobrevive a recarregar a página. Pratos já iniciados e empregados contratados continuam persistidos. Durante desconexão a execução aguarda a reconexão; uma operação recusada libera a próxima tarefa. A fila pausa durante decoração.

## Referências históricas e escolhas desta edição

| Evidência | O que comprova | Limite |
| --- | --- | --- |
| Acervo P039, `P039_01_empregadoscafemania_7259ac6b.jpg` | Janela “Empregados”, moldura creme, quatro cartões por página, cadeados e setas laterais | A captura mostra vagas bloqueadas; não comprova o seletor de amigos aberto |
| Artigo de suporte “Contratando Garçons”, atualizado em 10/05/2011, recuperado em `Acervo-CafeMania/06_inventario/faq_suporte_cafe_mania.md` | Ícone Contratar acima da barra de amigos; janela com empregados/vagas; escolha de um amigo, inclusive sem aplicativo | A coleta é local, em `C:/Users/Ulisses/Desktop/Projetos/Projeto-Cafe-Arquivo/CafeMania-Clone/Acervo-CafeMania/`; não confirma contratação automática inicial ou preço |
| [Garçons — 02/11/2010](https://thecafemania.blogspot.com/2010/11/garcons.html) | Relato com primeiro garçom no nível 3 e expansões de equipe | Diverge da configuração modificada disponível no projeto |
| `ripped/game-config.xml.txt` e `database/playerstate/level-extras.json` | Vagas desta edição nos níveis 1, 7, 15, 23, 31, 39 e 47 | XML adulterado: não tratado como regra oficial intacta |
| [Bug de prender garçom — 10/09/2010](https://dicas-cafemania.blogspot.com/2010/09/bug-de-prender-garcom-para-servir-mais.html) e captura P031 | Cerco com mesas, balcões ou outros objetos acelera o atendimento | Não documenta o algoritmo ou o tempo exato |
| [Dicas e Truques — Jogando Café Mania](https://jogandocafemania.blogspot.com/search/label/Dicas%20e%20Truques) e P111 | Atendimento sem caminhada e um arranjo específico de balcões | O relato cita dois garçons e acesso aos balcões; não prova que todo arranjo exigia dois |

**Provisório, sinalizado em `database/waiters.go`:** um empregado inicial automático para preservar o atendimento que o jogo já tinha; contratação gratuita; sete candidatos locais com uniforme/aparência existentes. A vaga do nível 1 é mantida. A pesquisa não confirmou como fato histórico um empregado automaticamente contratado desde a primeira entrada.

A tela abre pelo ícone atual de garçom na barra. Vagas livres abrem a seleção de candidatos; vagas futuras exibem cadeado e nível. A contratação passa pelo servidor, valida a capacidade dentro de transação e repetir a mesma contratação é idempotente. A escolha de contas/amigos reais e gorjetas continuam em H02. Não há integração com Orkut nem convite enviado a alguém.

## Atendimento compartilhado

Os garçons são atores `waiter`, separados dos clientes e do limite de clientes. O serviço Go reserva um cliente e uma porção disponível por tarefa, caminha até o balcão, mostra o prato nas mãos e caminha até a mesa. A porção e a receita de venda são confirmadas apenas na entrega, usando a transação de consumo existente. Clientes não se servem sozinhos nas salas com o novo contrato de empregados. Um roster nulo conserva apenas a compatibilidade interna com mundos legados; as salas atuais sempre publicam uma lista.

O cerco é uma compatibilidade intencional: se falta caminho **pela geometria** até o balcão ou a mesa, o garçom atende sem sair de onde está. Funciona com o único empregado inicial também, conforme o escopo solicitado, sem impor o arranjo de dois garçons do relato P111. Outro avatar no caminho não habilita a entrega instantânea: aguarda os mesmos 3 segundos e usa a travessia de personagens. O atalho não faz o ator atravessar paredes e não cria comida sem estoque.

Reservas impedem dois garçons de disputar o mesmo cliente e limitam tarefas pelas porções disponíveis. O consumo volta a validar o cliente e o estoque; uma entrega encerrada não é cobrada novamente. Contratações ficam no roster durável; posição e tarefa dos garçons são salvas junto dos clientes ao adormecer/encerrar o quarto. Movimento não grava por passo no banco.

Referência de arquitetura: [Nitro MovingObjectLogic](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/logic/MovingObjectLogic.ts) separa atualização de origem/destino da interpolação visual por tempo. Aqui o Go continua dono da simulação e o Pixi interpola as posições recebidas. A troca do tile lógico em 50% do passo foi preservada. O Nitro não comprova regras históricas de garçons do Café Mania.

## Arte

- Referência: `artes-referencia/cafe-mania-acervo-documentado/cafe-mania-acervo/imagens/interface-eventos-guias/P039_01_empregadoscafemania_7259ac6b.jpg`.
- Reconstrução Image Gen, ferramenta integrada: `tools/waiters/panel-master.png`; prompt integral em `tools/waiters/prompt.txt`.
- PNG de execução: `game/public/assets/ui/employees/panel.png` (824×898), com origem/hash em `source.json`. Redução convencional do master, preservando alpha.
- Reutilizados: cadeado atual, botão verde sem texto da entrada, fechar dos temperos, seta do livro, ícone de uniforme da recompensa e aparência modular inicial. Ícones da barra atual preservados.
- Moldura, cartões, texto, cadeados, retratos, botões e hitboxes são separados. O popup usa `PopupOpening`, a mesma curva usada nos outros modais.
- Setas laterais centralizadas sobre as faixas amarelas: mesmo recuo de 16 px nas duas bordas e mesma altura no espaço lógico do painel. Alinhamento conferido no navegador.
- Os retratos são assados com as peças existentes do avatar; enquanto carregam usam o ícone de uniforme existente. As margens transparentes da célula são retiradas na apresentação para o rosto ficar legível. A moldura é uma reconstrução baseada na captura, não um sprite original recuperado nem uma cópia pixel a pixel.

### Variedade dos rostos

Os sete candidatos locais usam combinações de olhos/bocas, sobrancelhas, cabelos e cores do catálogo permitido para NPCs, mantendo as peças do uniforme inicial. Pares de olhos/bocas são diferentes enquanto houver combinações suficientes. A escolha usa uma semente do café e permanece estável entre consultas/reinícios com o mesmo catálogo; reabrir o menu não sorteia outro rosto. Cores especiais mantêm a chance de 5% usada pelos clientes.

Empregados locais já contratados recebem o mesmo visual do cartão correspondente e mantêm nome, ID, vaga, posição e tarefa. A atualização visual é publicada pelo servidor; a aparência atualizada também é salva no encerramento normal do quarto. A configuração de NPCs continua limitando as peças disponíveis; se um slot essencial não tiver peças utilizáveis, a geração falha em vez de liberar uma peça desabilitada.

Referência de arquitetura: [Nitro AvatarVisualization](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/avatar/AvatarVisualization.ts) atualiza a figura visual a partir do modelo, mantendo direção/postura como estados próprios. Aqui a alteração usa a aparência do ator e a troca de atlas já existente; não recria o ator nem altera a caminhada. Isso é uma referência de separação de responsabilidades, não o mesmo algoritmo gráfico.

Não foi necessária arte nova: rostos e cabelos reutilizam as texturas e malhas existentes. A investigação da satisfação está separada em [satisfação e popularidade](satisfacao-e-popularidade.md).

## Verificações

- `node --test tests/unit/chef-queue.test.mjs`: quatro testes usando os métodos reais de `RoomScreen` para FIFO/receita e fogão capturados, abertura durante preparo, duplicatas/remoção, limpeza/serviço e alpha dos pendentes.
- Go, arquivos relacionados: entrega com caminhada e prato, cobrança só na entrega, cerco estático, reserva exclusiva, ator não habilita teleporte, restauração de posição/tarefa e regressões de travessia.
- PocketBase com banco temporário: empregado inicial, vagas por nível, candidato inválido, contratação repetida, roster durável e salvamento/validação dos garçons.
- `npm run typecheck`.
- Rostos: testes de diversidade de olhos/bocas, estabilidade da semente, preservação do uniforme, respeito à lista permitida, atualização de empregados existentes, salvamento e troca visual sem reiniciar uma entrega.
- Conferência no navegador com o modal real em `game/dev/waiters.html`: quatro cartões, cadeados, seleção, contratação simulada, textos e composição. A página usa dados isolados, sem alterar a conta. Isso não substitui uma conferência completa de atendimento e decoração em sala ao vivo.

Não foram executados build de produção, suite completa ou testes de carga.
