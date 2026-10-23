# Máquina de Sucos

A máquina aparece na loja em **Decoração**, por **500 Ouro**. Esse preço de colocação é uma regra do projeto. Depois de colocá-la, clique nela para contratar o chaveiro por **20 caféGranas** e abrir os sabores básicos. O desbloqueio pertence ao jogador e vale para suas máquinas.

Preparar gasta energia e produz imediatamente um lote de copos. Quando um cliente pedir suco depois da refeição, clique no balão para servir um copo de uma máquina com estoque. O atendimento concede Ouro, XP e Smilles e conta para o domínio daquele sabor. Ignorar o pedido de suco não reduz a popularidade. É preciso terminar o lote antes de preparar outro sabor; máquinas com copos não podem ser guardadas nem vendidas.

## Sabores e fontes

Os nomes e os três grupos vêm dos textos históricos do blog da Vostu preservados no acervo local. As artes são recortes RGBA do painel Behance `4432119/003`, fornecidos pelo responsável. A interface usa texto e componentes do cliente atual; os ícones antigos de interface não foram incorporados.

| Grupo | Sabores | Recortes |
| --- | --- | --- |
| Básicos | Suco de Laranja, Suco de Uva, Limonada, Suco de Abacaxi | 01, 04, 02, 03 |
| Médios | Suco de Maracujá, Suco de Morango, Suco de Tangerina, Suco de Kiwi | 08, 09, 07, 06 |
| Tropicais | Suco de Guaraná, Suco de Melancia, Suco de Manga, Suco de Acerola | 12, 11, 13, 10 |

“Limonada” é o rótulo do menu histórico de lançamento; textos posteriores também dizem “Suco de Limão”. O recorte 05 contém a máquina. Sua base foi alinhada à projeção 2:1, com offsets registrados no manifesto. O acervo tem uma vista da máquina, reutilizada nas rotações; não foram inventadas outras vistas.

Referências:

- Blog oficial, **24/08/2010**, texto da Máquina de Sucos e imagens `juice4.jpg`, `juice5.jpg` e `JM_States.jpg`, preservados em `Acervo-CafeMania/03_referencia_cafe_mania/imagens_blog/2010/08/` e `06_inventario/blog_cafe_mania_posts.md` na cópia local indicada pelo responsável.
- Blog oficial, **06/01/2011**, lista de sabores e prêmios por domínio, transcrita no mesmo inventário. O [espelho histórico do Blog de Dicas](https://cafemaniablogdedicas.blogspot.com/2011/02/) também reproduz essas informações.
- [Captura de 28/11/2016 no Wayback](https://web.archive.org/web/20161128072116/https://cafemaniablogdedicas.blogspot.com/), indicada pelo responsável. A consulta automática desta captura não retornou o conteúdo; as imagens equivalentes do acervo local foram usadas na implementação.

## Valores confirmados e calibração

A imagem histórica `juice4.jpg` mostra estes valores para os básicos. Energia é o custo de um preparo; os bônus são por copo servido.

| Suco | Energia | Copos | Ouro/copo | XP/copo | Smilles/copo |
| --- | ---: | ---: | ---: | ---: | ---: |
| Laranja | 9 | 5 | 24 | 2 | 1,2 |
| Uva | 22 | 6 | 37 | 2 | 1,5 |
| Limonada | 35 | 8 | 80 | 1 | 1,0 |
| Abacaxi | 43 | 9 | 16 | 5 | 1,0 |

O chaveiro por 20 caféGranas e a recarga completa por 4 caféGranas também aparecem nas referências originais. A alternativa de abrir a caixa adicionando três vizinhos depende de um sistema social que esta distribuição ainda não tem; a implementação oferece o chaveiro.

Os números completos dos oito sabores seguintes não foram confirmados. Estão marcados como `project-provisional` no catálogo: médios usam 12 energia, 12 copos e bônus de 40 Ouro/3 XP/0,5 Smilles; tropicais usam 18 energia, 16 copos e 60 Ouro/4 XP/0,6 Smilles.

Outras escolhas do projeto: domínio após **80 copos de cada sabor**, próximo grupo ao dominar os quatro anteriores, regeneração de **1 energia a cada 4 minutos**, chance de pedido de **50%** após comer, espera de **15 segundos** e permanência bebendo de **3 segundos**. Não representam uma reconstrução de todos os níveis históricos. Os nomes históricos dos prêmios ficam em `masteryReward` como referência; esses móveis e personagens de recompensa ainda não são entregues pelo domínio.

## Código e verificação

`scripts/import-juice-assets.mjs` copia os 12 recortes de bebidas e gera os catálogos do cliente e de `shared/juicecatalog/`. O estado durável fica nas coleções privadas `juice_state` e `juice_operations`, criadas pela migração `202610130001_juices.go`. Energia, saldo, estoque, domínio e recibo são gravados na mesma transação. O servidor do quarto valida o NPC e seu pedido antes de servir; usa um identificador próprio do pedido para impedir bônus duplicados. O estoque é publicado pelo WebSocket para dono e visitantes.

Verificações executadas: testes Go específicos de transações, posse, energia, recarga e pedidos de NPC; regressão de profundidade da cadeira; geometria da oficina; catálogo e typecheck. Uma sessão isolada com banco temporário e dois clientes reais confirmou compra, desbloqueio, preparo, restrição do visitante, pedido do NPC, estoque compartilhado e repetição sem duplicar recompensas. A conferência WebGL usou o avatar real sentado e comendo nas quatro direções; o menu foi exercitado com uma API de fixture, complementada pela verificação real dos serviços. As capturas registram quadros específicos, não todas as combinações de móveis de uma sala.

A cadeira usa a pegada e a camada do móvel de apoio para ordenar seu ocupante. A revisão separa assento, corpo e encosto traseiro, conforme [encostos e personagem sentado](encostos-cadeiras.md). A referência técnica foi o [Nitro Renderer](https://github.com/billsonnn/nitro-renderer), especialmente as camadas de FurnitureVisualization e AvatarVisualization; a solução mantém a geometria e as adaptações deste runtime. A interpolação de movimento e a troca do tile lógico na metade do passo permanecem preservadas.

## Interface modular e evolução visual

O menu segue o gabarito de 596×518 medido na captura do responsável: moldura azul/turquesa, título com laranja, quatro abas, máquina à esquerda, painel de evolução, quatro cartões, barras azuis e botões verdes. `JuiceInterfaceParts.ts` monta moldura, abas, cartões, botões, barras, ícones e texto separadamente. O título e o painel ilustrado estão em `game/public/assets/ui/juice-machine/`. São reconstruções com **imagegen**, não recortes idênticos pixel a pixel; os prompts e a origem estão em `generated-source.json`. Os ícones de recursos continuam vindo dos assets atuais do HUD.

As abas **Simples**, **Elaborados** e **Poderosos** apresentam os grupos basic, medium e tropical do catálogo existente. **Exóticos** reproduz a quarta aba da referência, mas permanece indisponível, pois não há receitas cadastradas para esse grupo. O menu usa os nomes e valores reais do catálogo, em vez das repetições “Suco de Laranja” e números de demonstração presentes na captura. Recarga e instruções ficam no botão **?**; clicar no ícone de energia também abre essa ajuda.

As quatro máquinas ficam em `game/public/assets/items/juice_machine/stages/`:

- Estágio 1: recorte original com dois reservatórios retangulares.
- Estágio 2: reconstrução com três reservatórios retangulares.
- Estágio 3: reconstrução com quatro reservatórios cilíndricos.
- Estágio 4: reconstrução com reservatórios arredondados e estrutura escura.

O estágio inicial reutiliza o PNG original transparente. As outras três artes foram geradas a partir das referências e corrigidas com imagegen para remover o contorno branco externo. As partes brancas da carcaça foram preservadas. Arquivos `source-v1/v2` conservam as saídas de geração; `stage-N.png` é a arte para preview e `stage-N-room.png` é o sprite calibrado para o piso 160×80. O pacote tem uma vista por máquina; não contém quatro ângulos inéditos de cada uma.

O estágio é calculado no servidor a partir do domínio persistido: inicial, depois todos os Simples dominados, depois Elaborados, depois Poderosos. Esse ritmo é uma regra do projeto, não um nível histórico confirmado. O WebSocket publica o estágio junto do estoque, atualizando a máquina do cenário para dono e visitantes. A troca de textura mantém a pegada, profundidade, interação e unidade de inventário.

Para reexportar fontes, previews e registros de apoio preservados:

```sh
node scripts/pack-juice-interface.mjs
```

Verificação adicional executada: typecheck, testes Go de domínio/evolução e sucos, conferência WebGL de quatro abas e interações, e sessão real com dois clientes em banco temporário confirmando estágios 2, 3 e 4 compartilhados. A conferência dos sprites usa o método de atualização do RoomScreen e registra tile, rotação, dimensões e offsets. Os serviços isolados foram encerrados ao final.
