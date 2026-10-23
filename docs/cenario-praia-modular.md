# Cenário modular da praia — plano de execução

Levantamento de 22/10/2026, originalmente entregue apenas como plano. **Atualização após autorização e revisão: orla urbana reconstruída e integrada com 25 PNGs Image Gen ou recortes dessas artes em 41 partes posicionáveis.** Veja [execução e verificações](cenario-cafe-urbano.md). A filial na praia e a viagem de barco continuam fora deste lote. O plano abaixo preserva as decisões e lacunas levantadas antes da execução.

## Referências verificadas

O vídeo `cafe mania muito tempo de jogo.mp4`, na raiz, mostra dois ambientes distintos:

| Evidência | O que permite observar | Limite |
| --- | --- | --- |
| 00:25 e 00:48–00:50 | Orla da cidade: mar azul, espuma branca, faixa de areia, píer com corrimão, lancha, guarda-sóis verde/branco e laranja/branco, espreguiçadeiras, boia, pedra e vegetação; rua transversal e calçada de pedra | Interface e menu cobrem parte do píer/barco; o café oculta a faixa inferior |
| 01:00 e 01:40–01:50 | Mar amplo, ilhota e deslocamento do barco com rastro | Não comprova todas as direções ou todos os quadros de animação |
| 01:20–01:30 | Filial sobre areia, costa curva, píer de madeira de outra forma, canteiros/vegetação | Móveis, vendedores e decoração colocada pelo jogador não são automaticamente parte fixa do cenário |
| 02:00 | Orla urbana e encontro de rua, calçada, gramado, árvores e construção elevada | Construção funcional depende de missões; o vídeo não entrega suas regras completas |

Os 12 quadros nativos e horários estão em [quadros.json](../artes-referencia/cenario-praia/video/quadros.json); as folhas [1](../artes-referencia/cenario-praia/video/contato-01.jpg) e [2](../artes-referencia/cenario-praia/video/contato-02.jpg) servem para navegação. Os quadros adicionais de 25, 48, 85, 95 e 118 segundos estão em `artes-referencia/cenario-praia/detalhes/`; foram extraídos diretamente, sem aprimoramento. O índice principal registra o hash do vídeo e os PTS; os detalhes adicionais usam o instante solicitado, sem prometer precisão de PTS.

![Orla urbana no vídeo](../artes-referencia/cenario-praia/orla-cidade-00m50s.png)

Outra referência conferida: [prancha 002 de Erica Perez](../artes-referencia/cafe-mania-acervo-complementar-2/cafe-mania-acervo-2/artes/49023909/002.png), [portfólio de origem](https://www.behance.net/gallery/49023909/Cafe-Mania-Vostu). Mostra a mesma orla, píer e barco, com enquadramento mais amplo. É uma apresentação achatada de 1400×910, com HUD e decoração sobrepostos; seu canal alfa não transforma o cenário interno em sprites separados. As demais pranchas desse portfólio foram conferidas por folha de contato e não fornecem um kit completo do cenário.

`game/public/assets/ui/cafe-welcome/praia.webp` é um wallpaper de abertura: **não** é o mapa isométrico da praia. Não esticar essa imagem como chão do cenário. A busca textual nos metadados dos acervos principal e Behance não encontrou um kit identificado de terreno/píer pronto para execução; nomes numéricos exigem conferência visual, portanto isso não prova ausência em todo o acervo.

## Peças e reaproveitamento

| Peça proposta | Separação modular | Fonte/decisão antes de produzir |
| --- | --- | --- |
| Mar | Base repetível e detalhes discretos da superfície | Vídeo 01:00/01:50; extrair área limpa quando suficiente; Image Gen apenas se não houver recorte utilizável para repetição |
| Areia | Base repetível separada dos objetos | Vídeo 01:20 e orla 00:50; calibrar cor/granulação da versão urbana, sem misturar com a filial |
| Borda da água | Trechos observados de costa, espuma e transição, com encaixes definidos | Recorte de referência + Image Gen para reconstrução limpa quando necessário; não inventar curvas para partes não vistas |
| Píer urbano | Piso, postes/apoios, corrimão traseiro e corrimão frontal | Vídeo + prancha 002; procurar recorte limpo antes de gerar cada parte encoberta. Plano de água abaixo, barco entre camadas quando a referência mostrar |
| Lancha atracada | Casco/cabine e sombra/contato com a água, separados do píer | Reconstrução por Image Gen se não houver PNG original adequado. Não inferir sprites de navegação a partir de uma vista parada |
| Guarda-sóis | Verde/branco e laranja/branco, sombra separada | Comparar com os itens cadastrados e pranchas existentes; usar somente o modelo que coincide com a referência |
| Espreguiçadeiras e boia | Objetos independentes com apoio no chão | Usar as formas e cores visíveis; Image Gen se não houver arte limpa equivalente |
| Rocha e vegetação | Rocha, planta e respectivas sombras como peças | Prancha 002 e vídeo; reaproveitar apenas equivalentes visuais confirmados |
| Rua e calçada urbana | Trechos retos e encontro com a faixa de areia | A rua atual é uma referência técnica de composição, oriunda de Restaurant City. O cenário definitivo deve seguir a rua/calçada **cinza** do Café Mania, não copiar a calçada rosa atual |
| Personagens da orla | Fora do primeiro lote estático | Separar figurantes/vendedores de objetos de fundo; preservar comportamento e animações como dependência futura |

Classificar cada entrega como **PNG original pronto**, **recorte/calibração de referência** ou **reconstrução Image Gen**. Não rotular uma reconstrução como asset recuperado. Não gerar partes que continuam sem referência suficiente.

## Ordem de implementação proposta

1. **Prancha de comparação e mapa de peças.** Medir origem da sala, linha da costa, tamanhos e pontos de apoio nas duas referências. Apresentar recortes e candidatos reais do acervo lado a lado, com lacunas marcadas. Essa é a próxima entrega recomendada.
2. **Protótipo de mar + areia + costa.** Gerar somente as peças faltantes com Image Gen a partir dos recortes aprovados; manter cores chapadas, contornos e sombras do original, sem brilho, realismo ou enfeites extras. Montar uma prévia isolada antes de trocar o cenário do jogo.
3. **Píer, barco e objetos da orla urbana.** Produzir/reutilizar uma peça por vez, verificar contra a referência e montar em camadas. Revisar proporções e encaixes a cada lote pequeno.
4. **Integração do fundo urbano.** Manifesto de cenário com peças, posições, escala, origem e camadas. Manter a câmera e o mapa lógico do café independentes da arte. Só marcar concluído depois de conferir pan, zoom, expansão do café e sobreposição dos atores.
5. **Filial e viagem, em propostas próprias.** Primeiro mostrar a composição visual separada da filial. Salas independentes, inventário, troca de local, retorno, barco em movimento e requisitos de desbloqueio exigem regras/persistência adicionais; não vêm implicitamente com o background.

## Contrato técnico e de arte

- Usar a grade atual 160×80, projeção 2:1. Cada peça terá dimensões originais, offset em relação à origem, ponto de apoio e camada; o espaço transparente do PNG não determina sua profundidade.
- Proposta de arquivos: `game/public/assets/scenery/coast-city/scene.json`, `terrain/`, `props/` e `overlays/`; fontes, prompts e masters em `tools/scenery/coast-city/`. A estrutura será criada na execução, não neste levantamento.
- Chão/mar ficam na camada de cenário e acompanham pan/zoom. Corrimãos e objetos que realmente se sobrepõem a personagens usam âncoras no chão e camadas frontal/traseira. Apenas a arte distante fica fora do sorter.
- Repetição deve ter bordas verificadas, sem emendas e sem repetir um objeto singular. As partes de costa compartilham os mesmos pontos de encaixe; PNGs não terão recortes arbitrários de faixas/calçadas como o defeito da rua anterior.
- Não alterar a troca de tile lógico a 50% do passo. Navegação compartilhada continua no Go; PocketBase não recebe gravações por quadro. Um fundo decorativo, sozinho, não cria novas áreas caminháveis.
- Salvar cada referência/crop, prompt, master, PNG publicado e manifesto de procedência. Para ampliações, comparar linhas, silhueta, quantidade de objetos e cores; mais pixels não significam detalhe historicamente confirmado.
- **Meta: fidelidade à referência.** Image Gen pode reconstruir, mas não garante identidade pixel a pixel. Se um resultado alterar detalhes, revisar ou rejeitar; usar os pixels originais sempre que a extração for viável. Áreas encobertas permanecem pendentes em vez de receber invenções.

## Aceite por lote

Conferir peças isoladas e composição contra os mesmos recortes; teste de repetição em pelo menos 2×2 peças; transparência sem halo; pan nos limites; zoom 0,55–1 e extremos 0,40/2,40 no modo bitter; expansão de terreno sem buracos. Para sobreposição, registrar posição, direção, tile lógico e instante dos atores. A viagem de barco só terá teste de integração quando esse sistema for aprovado e implementado.

Referência arquitetural: [RoomPlane, Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/room/RoomPlane.ts), consultada nesta etapa. O código mantém origem/lados, projeção, offsets e máscaras separados. Aplicamos esse princípio ao encaixe espacial; nosso cenário atual é uma composição de sprites e não usa o rasterizador de planos do Nitro.
