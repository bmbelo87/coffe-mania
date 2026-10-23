# Café inicial de 2014 — assets que faltam

Referência: captura do café de um jogador novo, 7 de janeiro de 2014 (cenário de inverno). `ensureRoom` (`database/room.go`) usa os assets disponíveis e preserva o salão da referência; a cozinha foi adaptada para duas fileiras com corredor. Esta lista mostra o que ainda falta na arte histórica. Para testar numa conta existente, use **Ferramentas de desenvolvimento → Recriar café inicial**. O comando apaga os móveis, os pratos e o tamanho do café da conta; moedas e nível são mantidos.

## Como o café inicial está montado

Piso 6x9: x de 1 a 6 ao longo da parede da porta (direita) e y de 1 a 9 ao longo da parede esquerda. A linha 0 e a coluna 0 são paredes.

| Peça | Tile (x,y) e rotação | Asset atual | Na captura |
| --- | --- | --- | --- |
| Fogão ×3 | (1,9) r3 · (2,9) r3 · (3,9) r3 | `starter_stove` | Fogão-grelha cinza de inox; fileira adaptada junto à borda, voltada ao nordeste |
| Balcão ×3 | (1,7) r1 · (2,7) r1 · (3,7) r1 | `starter_counter` | Balcão de vidro com base de inox; fileira voltada ao corredor y=8 |
| Mesa quadrada ×4 | (2,2) · (2,4) · (4,3) · (4,5) | `white_cloth_table` | Toalha branca com saia vermelha |
| Cadeira ×4 | (1,2) r0 · (1,4) r0 · (5,3) r2 · (5,5) r2 | `classic_chair` | Madeira escura com assento vermelho |
| Mesa redonda | (6,2) | `acervo_lote02_table_italy_green_check` (reconstrução) | Toalha xadrez verde |
| Cadeira verde ×2 | (6,1) r1 · (5,2) r0 | `acervo_lote02_chair_italy_green` (reconstrução) | Madeira com assento verde |
| Porta | (3,1) r1 | `mafia_door` | Porta de vidro com moldura de madeira e plaquinha |
| Janelas | parede direita (1,0) e (5,0); parede esquerda (0,7) | `basic_window` | Moldura marrom, vidro azul |
| Quadro de cardápio | (0,1) | `menu_holder` | Quadro-negro com moldura de madeira |
| Painel de conquistas | (0,4) | `achievement_panel` | Possivelmente o quadro grande com toldo (ver abaixo) |

As posições históricas foram estimadas a olho a partir de uma única captura em perspectiva. A cozinha atual tem duas fileiras de três peças, com os tiles (1,8), (2,8) e (3,8) livres e acesso pelo tile (4,8). A migração `202610200001_kitchen_rows.go` reorganiza apenas cozinhas que ainda correspondem integralmente ao padrão antigo e têm a área nova livre; mantém unidades, pratos e vínculos de cozimento. Salas personalizadas ficam intactas. Caixa de correio e arbustos saíram do café inicial porque não aparecem na captura.

## Assets que faltam

Formato: PNG com transparência, grade nativa de tile 160×80 e projeção 2:1, processado no Asset Studio (`tools/asset-positioner/`). Cada item fica em `game/public/assets/items/<classname>/` com `item.json` e as partes das rotações; depois rode `npm run assets:room`. Para móveis, duas vistas (frente e costas) cobrem as quatro rotações por espelhamento. Peças de parede precisam da vista de cada parede.

### Prioridade 1 — móveis do café inicial

| Asset | Tipo (`kind`) | Tamanho | Vistas | Observação |
| --- | --- | --- | --- | --- |
| Mesa quadrada com toalha branca e saia vermelha | `table` | 1×1 | frente e costas | Substitui `white_cloth_table` no início; o prato fica no centro do tampo |
| Cadeira de madeira com assento vermelho | `chair` | 1×1 | frente e costas | Altura do assento como as cadeiras atuais (32 px no apoio) |
| Mesa redonda com toalha xadrez verde | `table` | 1×1 | uma vista basta (redonda) | Substitui a reconstrução do acervo |
| Cadeira com assento verde | `chair` | 1×1 | frente e costas | Par da mesa verde |
| Fogão inicial (grelha cinza) | `stove` | 1×1 | frente e costas | Conferir se `starter_stove` já é este fogão; se não, criar `starter_stove_2014` |
| Balcão inicial (vidro e inox) | `counter` | 1×1 | frente e costas | Prato servido em cima, no ponto de comida do runtime |

### Prioridade 2 — paredes e porta

| Asset | Tipo | Onde | Observação |
| --- | --- | --- | --- |
| Porta de vidro com moldura de madeira e plaquinha | `door` | parede direita | Tem de abrir no vão, como `mafia_door` (ver `door` no manifesto) |
| Janela de moldura marrom e vidro azul | `window` | as duas paredes | Comparar com `basic_window`; se for a mesma, só ajustar a cor |
| Quadro-negro de cardápio | `panel` | parede esquerda, junto ao canto | Substitui a arte do `menu_holder` (2 tiles de largura) |
| Quadro grande com toldo vermelho e branco ("ALIATI") | `panel` ou decoração de parede | parede esquerda, no meio | Confirmar se é o painel de conquistas; se for, trocar a arte do `achievement_panel` |
| Conjunto de porta-retratos | decoração de parede | parede esquerda | Item novo |
| Relógio de parede vermelho | decoração de parede | parede esquerda, perto da frente | Item novo |
| Arandela/lampião ×2 | decoração de parede | parede direita, dos dois lados da porta | Item novo |
| Telefone público (orelhão) laranja | decoração de parede | parede direita, no fim | Item novo |

Decoração de parede ainda não tem `kind` próprio. Hoje só `window` e `panel` ficam presos na parede; os itens novos podem entrar como `panel` até existir uma categoria.

### Prioridade 3 — fora do café

| Asset | Observação |
| --- | --- |
| Placa "Terreno à venda" | Feita: PNG em `game/public/assets/scenery/land-sale/`, reconstruída da captura (`tools/acervo/fontes/placa-terreno/`) |
| Piso do pátio (pedra cinza) e mureta com vão | O pátio funciona com o piso de grama existente; faltam a pedra e a mureta das capturas |
| Estacionamento com faixa zebrada e quadrado verde, placa "E" | Ao lado da parede da porta; ligado aos suprimentos no original |
| Chão nevado, tocos de madeira, bengala doce, guarda-sol listrado | Cenário de inverno de janeiro de 2014; sazonal, opcional |

### Prioridade 4 — interface

| Asset | Observação |
| --- | --- |
| Cartão de expansão (moldura, cadeado, botão "Comprar") | Hoje é desenhado em código em `StoreActionBar.renderCards`; o ícone laranja já é o do conjunto atual (`icon_bundle_8.png`) |
| Janela "Comprar Expansão?" e "Bloqueado!" | Hoje desenhada em `ExpansionModal.ts` |

Os ícones de `game/public/assets/ui/` seguem o padrão da atualização mais nova e não devem ser trocados por recortes antigos.

## Fora do escopo dos assets

- O pátio já pode ser comprado pela placa (4x4 e depois 7x6); falta só a arte da pedra e da mureta.
- Pratos já servidos nos balcões na captura (frango assado com frutas, hambúrguer, salada, queijo) vêm do jogo em andamento. O café inicial começa sem comida.
