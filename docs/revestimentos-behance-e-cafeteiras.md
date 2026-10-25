# Revestimentos do Behance e encaixe das cafeteiras

Revisão concluída em 25/10/2026. O lote reaproveita a arte disponível no acervo, mantém os itens anteriores e não altera a grade, a navegação, a calibração do passo nem a simulação do servidor.

## Cafeteiras

As versões posicionadas dos três estágios usam `stage-N-room-aligned.png`, em `game/public/assets/items/coffee_machine/stages/`. Os tamanhos exportados continuam 170×234, 170×231 e 170×258 px. As prévias da janela e as fontes anteriores foram preservadas.

O problema da prata estava no apoio inferior: as arestas mediam aproximadamente 31,38° e 25,88°, em vez de 26,565°. A correção atua por coluna somente abaixo da plataforma da carcaça: conserva X, mantém as verticais verticais e copia a região superior sem reamostragem. O export final tem escala uniforme. Xícaras e controles ficam preservados; os testes comparam os pixels das regiões protegidas. A ferramenta de encaixe mediu 26,6°/26,6° nas arestas rasterizadas da prata após a redução.

Os controles e o método reproduzível estão em [room-projection.json](../tools/coffee-machine/room-projection.json) e [align-room-projection.mjs](../tools/coffee-machine/align-room-projection.mjs). Na dourada o apoio é inferido do contorno arredondado: os controles geométricos não significam que todo trecho curvo do PNG seja uma reta a 26,565°.

Duas tentativas com o ImageGen integrado não corrigiram satisfatoriamente a inclinação e foram rejeitadas. Nenhuma dessas novas gerações foi colocada no jogo. Os prompts e motivos da rejeição estão em [angle-attempts.json](../tools/coffee-machine/angle-attempts.json). A solução final calibra os pixels da arte que já estava aprovada com o reamostrador de alfa pré-multiplicado do Asset Studio.

Como referência técnica, [FurnitureVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/master/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts), em `updateSprite`, trata textura, offsets e profundidade relativa separadamente. Aqui a correção fica na arte e no registro do estágio; não usa a altura do PNG para mudar a ordem dos objetos.

Comparação offline: `.runtime/coffee-angle-audit/comparison.png`, com os três estágios antes/depois, parede real, máquina de sucos e o `RoomDepthSorter` do jogo. O relatório registra tile (1,1), rotação 0 e instante 0 para os seis quadros.

## Doze pisos e doze papéis de parede

Fonte: [Vostu Games, Manati P](https://www.behance.net/gallery/43063757/Vostu-Games), pranchas `artes/43063757/008.jpg` e `009.jpg` do acervo documentado em `artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance/`. O portfólio contém outros jogos; foram usados somente os conjuntos visualmente identificados no bloco Café Mania. A publicação da prancha não comprova o ano de introdução de cada item.

| Conjunto | Piso | Parede |
| --- | --- | --- |
| Egípcio | `behance_floor_egypt` | `behance_wall_egypt` |
| Clássico | `behance_floor_classic` | `behance_wall_classic` |
| Cartas | `behance_floor_cards` | `behance_wall_cards` |
| Oriental | `behance_floor_oriental` | `behance_wall_oriental` |
| Balões | `behance_floor_balloons` | `behance_wall_balloons` |
| Confetes | `behance_floor_confetti` | `behance_wall_confetti` |
| Festa Junina | `behance_floor_june_festival` | `behance_wall_june_festival` |
| Circo | `behance_floor_circus` | `behance_wall_circus` |
| Circo decorado | `behance_floor_circus_deluxe` | `behance_wall_circus_deluxe` |
| Céu noturno | `behance_floor_night` | `behance_wall_night` |
| Azulejos azuis | `behance_floor_blue_tiles` | `behance_wall_blue_tiles` |
| Parquet e parede geométrica | `behance_floor_parquet` | `behance_wall_parquet` |

As imagens foram extraídas e retificadas, sem geração de desenhos substitutos. São recortes de JPEG de portfólio, e não PNGs originais recuperados. A resolução e a compressão dessas fontes limitam o detalhe em ampliações grandes.

A calibração final mede o período de repetição no plano retificado e extrai uma unidade interna de cada textura. Os quartos das pranchas têm 2×2 tiles, mas o motivo já se repete a cada tile; o lote final usa um PNG por item, sem depender de fases vizinhas. A janela de amostragem evita rodapé, sombras externas e fundo cinza da prancha. Os manifestos registram período medido, fonte, URL da imagem e hash do acervo.

- Pisos: `tile.png`, 162×82 px, registro (-81,-1), incluindo margem de cobertura para o losango lógico de 160×80.
- Paredes: `wall.png`, 80×248 px, registro (-80,-168), face útil de 208 px e orientação canônica 1; a outra parede é espelhada pelo renderizador existente.
- IDs: pisos 9150201–9150212; paredes 9160201–9160212.
- Nomes descritivos, sem confirmação dos nomes comerciais históricos.
- Preço provisório: 10 ouro, indicado em `source.provisionalRules.priceGold`. As pranchas não fornecem preços.

Extração reproduzível: [import.py](../tools/surfaces-behance/import.py). Lista dos arquivos finais: [exports.json](../tools/surfaces-behance/exports.json). Os catálogos do cliente e do Go foram sincronizados. As novas peças aparecem nas categorias existentes de pisos e paredes após a próxima inicialização do servidor, que recompila o catálogo incorporado.

## Verificação

Sete testes específicos de café, calibração e superfícies passaram, incluindo comparação de pixels das xícaras, IDs únicos, dimensões, alfa e períodos de repetição. `npm run assets:room` validou 76 itens, 21 receitas e 16 cafés. `npm run typecheck` passou.

A prévia Pixi offline carregou os 24 revestimentos, repetiu cada conjunto num quarto de 4×4 tiles, mostrou as duas faces da parede e gerou quadros das quatro orientações de piso sem erros de JavaScript. Arquivos: `.runtime/surfaces-behance/preview.png`, `rotation-1.png` a `rotation-3.png` e `report.json`.

Nenhum servidor de jogo ou banco foi iniciado para essas verificações. Não foi executada uma compra em banco nem uma sessão multiplayer ao vivo. E02/E03 e os demais lotes funcionais continuam com seu andamento anterior.
