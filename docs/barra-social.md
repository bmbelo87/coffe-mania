# Barra social — visual de 2012–2014

Lote visual entregue em 23/10/2026. A barra deixa de usar os oito cartões `beta`, níveis fixos e números aleatórios. O sistema persistente de vizinhança M12 continua pendente.

## Referências e variantes

| Fonte local | O que comprova |
| --- | --- |
| `.runtime/recipe-video/todos/quadros/quadro-487.png`, 00:45.245 | Captura do jogo: convites laranja “Agregar Amigo” nas duas pontas, seis jogadores no meio, nome, retrato com fundo laranja, silhueta cinza, nível e número inferior |
| `artes-referencia/cafe-mania-acervo-complementar-2/cafe-mania-acervo-2/artes/4059699/014.jpg` | Prancha de Guido Annuiti B., publicada em 28/05/2012: casal do convite em resolução melhor; moldura do retrato; também contém exemplos em espanhol e variações de apresentação |
| `artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance/artes/15414597/007.png` e `025.jpg` | Variante com convites azuis e Papa dos Pudins; não substitui os ícones atuais. O Papa dos Pudins foi recortado e guardado, mas não aparece como jogador |
| `artes-referencia/cenario-praia/video/quadros/quadro-008.png`, `009`, `011` | O carrossel ocupa temporariamente a mesma área dos cartões. Preserva a linha de ícones, tem fechar vermelho, quatro indicadores e setas pequenas |
| Mesmo projeto Behance `15414597`, `021.png` a `024.png` | Quatro banners originais completos: celular, Taqueria da María, +30% caféGranas e Fogões de Praia |

O portfólio de Mariano Martin Garnero foi publicado em 19/03/2014; isso não comprova a estreia de cada arte. A data real do vídeo não foi confirmada; a auditoria do projeto estima aproximadamente 2013. O número inferior do cartão é tratado como XP, seguindo a auditoria existente, mas o quadro isolado não prova sua semântica. Não foi atribuída uma função ao pequeno ícone dourado dos retratos: falta evidência.

## Arte e execução

- Barra de fundo, ícones atuais, espátula e controles azuis foram preservados.
- O convite combina os pixels originais do casal com moldura/botão vazios reconstruídos com Image Gen. “Agregar Amigo” é texto separado. A origem JPEG limita a nitidez dos personagens; as pontas dos chapéus já estavam cortadas no recorte.
- A moldura de retrato foi recortada de uma imagem existente; sua borda inferior, escondida pelo nível na referência, foi recomposta com a borda superior espelhada. O cartão branco foi remontado em nove partes com os pixels da moldura e do miolo branco do original Mariano `15414597/007.png`; a borda inferior usa o topo espelhado. Isso substitui o miolo cinza/bege do atlas atual. `python tools/social-bar/pack-crops.py --card-only` exporta somente esse cartão e seus registros.
- A silhueta cinza foi reconstruída com Image Gen, pois o nível cobria parte do busto no vídeo.
- Os quatro banners são cópias byte a byte dos PNGs do acervo. A base azul do carrossel usa fragmentos do quadro 008; bordas direita e inferior foram recompostas por espelhamento.
- PNGs, recortes, hashes e limites estão em `game/public/assets/ui/social/source.json`, `tools/social-bar/crops.json`, `generated.json` e `news-background.json`; os prompts finais ficam em `tools/social-bar/prompts.md`. Não são apresentados como sprites originais recuperados quando houve reconstrução.

O envelope abre/fecha as novidades nesta adaptação. A origem exata do acionamento e o intervalo automático não foram comprovados, então não foi criado um temporizador. As setas e indicadores funcionam; fechar restaura os cartões. Os anúncios preservam seu texto histórico, mas não executam compras nem abrem serviços antigos.

Não há captura da janela de convite aberta em 2012–2014. A janela atual usa a moldura creme existente e permite copiar o link do próprio café após clique explícito. É uma adaptação local para receber visitas, não uma reconstrução comprovada da janela histórica nem a criação de uma amizade.

## Preparação para jogadores reais

`SocialBar` recebe registros públicos tipados: `playerId`, `displayName`, `roomId`, `level`, `experience`, aparência e retrato opcionais. `RoomScreen.setSocialPlayers()` atualiza a lista. Oito posições contêm dois convites fixos nas extremidades e seis jogadores por página. Posições centrais vagas exibem “Vizinho” sobre o cartão branco e o quadro laranja vazio, conforme a referência de vizinhos enviada pelo responsável; não recebem nível, XP ou ação de visita/convite. Jogadores reais sem foto mantêm seu nome e usam a silhueta cinza; nomes indisponíveis também recebem o título “Vizinho”. O mesmo vale para a última página incompleta. Sem dados, nenhum jogador é inventado.

`onVisitPlayer` navega para `/play?room=<roomId>` e reutiliza o fluxo autenticado de visitas já existente. A listagem social não usa o inventário, a carteira ou a coleção privada `users`. O servidor do quarto não recebeu uma nova responsabilidade de persistência.

Para concluir M12 ainda faltam: endpoints de perfis públicos, relação persistente entre contas, pedido/aceitação/remoção, busca e ligação desses dados à barra. A visita também deve separar os metadados públicos do café visitado do estado privado do visitante; a barra de popularidade ainda recebe o estado do jogador autenticado. Não foi aberto acesso público à coleção `users`.

## Verificação

- `node --test tests/unit/social-bar.test.mjs`: cinco testes de identidade/duplicação, ausência de amigos, paginação com seis/sete jogadores, ausência de valores inventados e título “Vizinho” quando o nome não está disponível.
- `npm run typecheck`: tipos do cliente.
- Preview isolado em Chromium/WebGL: cartões com dados de fixture, estado vazio, segunda página, os quatro banners, callback de visita com o ID correto, convite/cópia e Escape; recompensa do servidor fecha o convite antes de assumir o foco. Imagens em `.runtime/social-bar/`.

Os nomes e valores nas imagens `friends.png` e `page-2.png` pertencem somente à fixture visual. Não foram cadastrados como contas ou amigos. Não foi feito E2E entre duas contas nem alterado qualquer banco neste lote.
