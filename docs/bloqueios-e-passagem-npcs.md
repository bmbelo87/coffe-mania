# Receitas bloqueadas e passagem entre personagens

## Livro

A aba Avançado fica disponível para consulta desde o nível1. O nível exigido continua em cada receita e é validado no servidor ao cozinhar. A falta de ouro conserva a apresentação normal do prato, com botão desabilitado; o bloqueio por nível usa o cartão cinza, alimento desaturado/desbotado, cadeado raster sobre a imagem e texto dinâmico de nível, sem tempo/XP/Cozinhar/Favorito naquele cartão.

Referência visual: `artes-referencia/video-cafe-mania-muito-tempo/receitas-0029-0046/selecionados/avancado-06-card-05.png` (Ovos Benedict), conferida com os cartões de Bolo Zumbi e Profiteroles na mesma página. O novo `game/public/assets/ui/recipe-book/card-locked.png` é uma reconstrução do fundo com Image Gen integrado, não um recorte original intacto. O cadeado reutiliza `assets/ui/padlock.png` sem redesenho por Graphics/SVG/CSS. Prato, cadeado, título e nível permanecem modulares.

[Prompt](../tools/recipe-lock/prompt.txt), [fonte e processamento](../tools/recipe-lock/source.json) e [mestre gerado](../tools/recipe-lock/card-locked-imagegen.png). `pack.py` apenas recorta a caixa alpha e reduz com Lanczos; não pinta o painel. O mestre permanece preservado. O botão roxo da captura é compra antecipada com caféGrana: seus preços não foram identificados para os16 pratos aplicados, e esta alteração não implementa esse mecanismo. Portanto, a reprodução do estado de nível não equivale à reprodução completa da compra antecipada.

## NPCs

O runtime já tinha tolerância de3s para atravessar personagens. O erro ocorria ao procurar cadeira: falhas temporárias por ocupação podiam incrementar visitas ou trocar o alvo por um passeio, esgotando tentativas antes de conseguir a cadeira. Uma passagem diagonal bloqueada também podia simplesmente apagar o caminho.

Agora a geometria estática é consultada separadamente da ocupação por personagens. Se existe uma rota respeitando móveis e paredes, o NPC espera sem gastar tentativa nem perder popularidade; depois de3s pode executar essa rota ignorando somente os personagens. Humanos não recebem essa permissão. A falha permanente de geometria mantém a desistência já existente. A classificação temporária fica em `blockedByActors`; não é persistida por passo no PocketBase.

Depois de um passo bem-sucedido, a contagem de imobilidade é zerada, inclusive durante a travessia. A procura de cadeira tenta outras cadeiras antes de esperar; esperas por pessoas não contam como falha de atendimento. Caminhos diagonais são recalculados se os dois cantos passam a estar ocupados. Fome, ausência real de cadeiras e outras causas de insatisfação mantêm suas regras; o teste de falta de comida continua cobrando a penalidade legítima.

Referência arquitetural: [MovingObjectLogic do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/logic/MovingObjectLogic.ts) recebe origem/alvo e calcula o deslocamento interpolado pelo tempo. Esse contrato orienta a separação usada aqui: a decisão de ocupação fica na simulação Go e o cliente apresenta os movimentos recebidos. O código Nitro não confirma uma regra de atravessamento do Café Mania nem o tempo de3s. A transição do tile lógico em50% do passo, a duração diagonal e a interpolação existentes foram preservadas.

## Conferência

`npm run typecheck` passou. Testes focados de `game-server/gameruntime` verificaram espera, travessia após3s, chegada à cadeira sem raiva, ausência de penalidade, bloqueio por móveis, ausência de permissão para humanos, desvio em canto diagonal, clientes frente a frente, cliente levantando cercado, desistência por móveis e fome legítima. Os testes novos ficam em `actor_obstruction_test.go`.

A conferência visual usou o modal real em `/dev/recipe-book.html`, estado simulado de nível1: Básico permanece colorido quando disponível e Avançado abre com seus cartões bloqueados. Essa conferência não comprova todos os cruzamentos numa sala multiplayer; a passagem foi validada na simulação determinística do servidor. O ambiente local continua aberto em `http://localhost:5173/`.
