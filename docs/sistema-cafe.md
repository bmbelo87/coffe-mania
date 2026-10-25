# Sistema de café — entrega modular

Entrega funcional de M05 em 24/10/2026. M06 (entrega dos móveis de domínio) continua pendente.

## Como usar

Na loja, categoria de decoração/plantas, coloque **Máquina de Café**. A colocação é gratuita e limitada a uma unidade por conta, incluindo unidades guardadas; estas duas regras são adaptações provisórias. Clique na máquina fora da decoração para abrir o painel. As quatro abas são consultáveis, inclusive as bloqueadas; somente sabores liberados podem ser selecionados. O café inicial é Espresso.

Depois da refeição, alguns clientes pedem café. Clique no balão para servir o sabor selecionado: o servidor verifica o cliente, consome energia, concede ouro/XP/popularidade e registra o domínio. Café não tem lote, estoque de copos, cozimento ou expiração. A energia e o relógio de recarga são compartilhados com as outras funcionalidades.

As três aparências são as fornecidas pelo responsável: prata, vermelha e preta/dourada. Não usamos a máquina cilíndrica com “CM” vista no vídeo de nível 400.

## Peças independentes

- `game/public/assets/ui/coffee-machine/`: painel de base, cabeçalho, ajuda, fechar, aba comum, aba ativa e cartão. A base foi esvaziada; cartões, janelas e abas são compostos separadamente. As bordas e faixas dos cartões reutilizam regiões sem texto da própria captura por meio de `CoffeeCardParts.ts`; imagens e letras da captura não são renderizadas. O estado em serviço usa o fundo laranja da referência. Texto variável, hitboxes e botões funcionais ficam no cliente.
- `game/public/assets/coffees/`: 16 xícaras/bebidas PNG transparentes e catálogo validado.
- `game/public/assets/items/coffee_machine/stages/stage-N.png`: imagens de prévia com resolução própria; cada modelo conserva sua proporção.
- `stages/room-stage-N.png` e `stages/catalog.json`: versões para a sala, amostradas uniformemente e registradas no chão. `item.json` mantém a pegada lógica 1×1.
- `CoffeeScreenModal.ts`: composição dos módulos. `coffee-model.ts`: progressão de apresentação. `coffee-client.ts`: comunicação e recibos de repetição. `coffees.ts`: carregamento de catálogos e arte.

As artes são **reconstruções ImageGen**, não PNGs originais recuperados. Referências, mestres, prompts das máquinas/bebidas e relatórios ficam em `tools/coffee-machine/`. `ui-source.json` registra os módulos e a especificação de reprodução da interface; os prompts originais dessa parte da geração não foram preservados. Os ícones de recursos reutilizam a interface atual. O botão de seleção e os rótulos constantes Dominado/Servindo foram reconstruídos com ImageGen a partir dos recortes específicos dessa janela; os novos prompts completos estão em `ui-revision-prompts.json` e `ui-label-prompts.json`. Os nomes usam Arial Black/Arial e fallbacks; o arquivo da fonte original não foi recuperado.

A primeira calibração automática tentava converter a silhueta inteira para um losango e achatava a máquina vermelha. Foi substituída por escala uniforme e apoio no contato inferior: corpos arredondados e pés não são cantos confiáveis de um losango. As prévias não usam a imagem reduzida da sala. Nenhuma projeção, colisão, tile lógico ou avanço de meia passada do personagem foi alterado. A referência técnica consultada foi [FurnitureVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/master/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts), especialmente a separação entre textura, offsets e profundidade em `updateSprite`. Aplicamos essa separação ao registro da arte; não copiamos seu algoritmo de profundidade.

Para reproduzir somente o registro das máquinas: `python tools/coffee-machine/register-machines.py`, `node tools/coffee-machine/calibrate.mjs` e `npm run assets:room`. O primeiro comando apenas reamostra os mestres PNG com escala uniforme; não redesenha a arte. Não execute o encaixe automático por ângulo nesses modelos.

## Evidências e diferenças históricas

A janela de madeira e os valores dos 16 sabores vêm de `videos-jogo/Café Mania level 400.mp4`, quadros 103/106/110/114 s (Básico/Médio/Avançado/Expert). SHA-256: `af43720fe03045ddeecd9fdd07a9a73b39550a9c72efcc877b8508ca475cf140`. O vídeo tem o HUD novo; a data de publicação não foi confirmada. As capturas ficam em `tools/coffee-machine/references/`. Textos anteriores a 2012 documentam regras, sem substituir os ícones atuais ou a aparência da janela nova.

O [FAQ de 03/03/2012, republicado de fonte oficial](https://cafemaniaevolution.blogspot.com/2012/03/faq-sucos-cafes-e-maquinas.html?m=0) descreve escolha de sabor, clique no balão, energia e domínio. Os requisitos de três vizinhos/20 Granas são de sucos; montagem, quebra e reparo são de outras máquinas e não foram atribuídos ao café. O [post oficial de domínio de 19/01/2011, preservado em republicação](https://cafemaniablogdedicas.blogspot.com/2011/02/) dá os nomes de 12 prêmios. O anúncio oficial de 30/11/2011 registra os quatro sabores Expert, mas os nomes de seus prêmios não foram confirmados. As três pequenas referências das máquinas pertencem à [prancha de Mariano Martin Garnero](https://www.behance.net/gallery/15414597/Cafemania-Vostu).

`shared/coffeecatalog/catalog.json` é a autoridade dos sabores e valores. `npm run assets:room` valida e copia o catálogo para o cliente. Energia, ouro, XP e popularidade dos sabores são transcritos das capturas. Permanecem explicitamente marcados em `provisionalRules`:

- metas cumulativas de domínio 20/50/100;
- máquina 2 após dominar Básicos e máquina 3 após dominar Básicos+Médios;
- colocação gratuita e máximo de uma máquina;
- recarga por 4 caféGranas.

A frequência de pedidos, espera e duração do consumo também estão marcadas como provisórias em `game-server/gameruntime/coffees.go`. O quadro inferior esquerdo de evolução e o conteúdo da ajuda são adaptações funcionais do projeto; não são telas históricas recuperadas. As ilustrações geradas podem diferir em pequenos detalhes da referência.

Ao dominar um sabor com prêmio conhecido, `coffee_rewards` grava elegibilidade única, com entrega pendente. Não há concessão de um móvel substituto: M06 precisa do mapeamento e da arte do item correto.

## Verificações realizadas

- `npm run assets:room`: 52 itens, 21 receitas de comida e 16 cafés validados/sincronizados.
- `npm run typecheck`: passou. Foi necessário trocar o uso de `findLastIndex` do painel administrativo por uma busca reversa equivalente, compatível com o alvo ES2022 já configurado.
- `node --test tests/unit/coffee.test.mjs`: domínio cumulativo, repetição após falha, resposta de sucesso incompleta e preservação de proporção/apoio dos três sprites.
- `go test ./database -run '^(TestCoffee|TestJuice|TestSupply)' -count=1`: passou.
- `go test ./shared/coffeecatalog ./game-server/gameruntime -run 'TestCoffee|TestJuice|TestDecoration|TestDiagonalStep' -count=1`: passou. Cobre validação de pedidos, exclusão entre café e suco, repetição, decoração, restauração e sincronização dos estágios.
- Chromium/WebGL: cliques nas quatro abas, consulta bloqueada, seleção, ajuda/voltar/fechar e proteção contra GET atrasado. Prévia com estágio 3. Sem erro JavaScript nesses casos.
- Sala e banco temporários, portas 5199/8198/8199: compra e colocação, seleção persistida e atendimento de NPC real. Descafeinado: energia 50→48, ouro 102→119, domínio 0→1. Repetição idêntica manteve 48/119/1. Banco principal preservado.

Resultados e screenshots dessa execução ficam em `.runtime/coffee-research/`. Screenshots isoladas não confirmam todas as posições da sala nem igualdade pixel a pixel com o Flash original. Não foi executada uma suíte completa.

## Revisão de fidelidade dos cartões

Após a primeira conferência, foram corrigidos o fundo laranja do sabor em serviço, a espessura das bordas, a posição e o tamanho das duas faixas de valores, o botão específico e os rótulos. Os valores continuam dinâmicos. A base não contém mais cartões pintados por baixo dos módulos. As quatro abas e as ações foram verificadas novamente no Chromium após a revisão. A composição foi comparada aos quadros de 103/114 s, incluindo o estado Dominado. A correspondência visual não equivale a um teste de igualdade pixel a pixel: as bebidas, o cabeçalho e rótulos são reconstruções e o quadro de evolução à esquerda continua sendo uma adaptação documentada.

A comparação visual lado a lado fica em `.runtime/coffee-research/comparacao-cartoes-final.png`: à esquerda, o quadro de 103 s; à direita, a prévia com os mesmos contadores servidos. Os contadores desse screenshot são apenas uma fixture da prévia, não alterações nos dados do jogador. A base usa preenchimento recortado da captura e máscara de recorte arredondada; Graphics não desenha ilustrações.

## Revisão das abas

As abas foram reconstruídas a partir da faixa da janela nova no quadro de 114 s, com peças próprias `tab-inactive-v2.png` e `tab-active-v2.png`. Foram removidos a linha interna clara e o gancho diagonal indevido da versão anterior. O estado inativo tem borda inferior reta; o ativo fica aberto para o corpo do painel. As posições lógicas são x=24/175/326/477, y=117, largura147, altura43 (ativa47), com encaixe do corpo em y=159.

Os títulos e cadeados continuam separados da arte. O título longo reserva uma faixa própria e não fica atrás do cadeado. O hover de uma categoria disponível realça a legenda em branco, como no quadro em que Médio está sob o cursor. Categorias bloqueadas continuam consultáveis, sem permitir selecionar uma receita proibida pelo servidor.

Prompts, recortes e exportação estão em `tools/coffee-machine/tab-prompts.json`, `references/ref-tab-*.png` e `tab-export.json`. São reconstruções ImageGen, não arquivos originais recuperados. A conferência de quatro cliques, hover e ausência de sobreposição entre cadeado e texto foi feita com `verify-tabs-offline.mjs`, usando arquivos locais e nenhuma porta HTTP. O relatório e as prévias ficam em `.runtime/coffee-tabs-qa/`. `npm run typecheck` foi usado para conferir o cliente.

As abas também possuem uma continuação vertical de 74 px, composta de capa arredondada preservada e haste reta, em `CoffeeTabParts.ts`. A parte inferior passa atrás da frente bege; a arte não é simplesmente esticada no eixo vertical. A área de clique permanece na faixa visível. A conferência offline verificou as quatro peças atrás do painel, altura74 e ausência de sobreposição entre cadeado e letras.
