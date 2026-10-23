# Nome do café e wallpapers de entrada

Lote E01, implementado em 20/10/2026 após apresentação do plano. Composição baseada nas duas capturas fornecidas: ilustração de fundo, frase branca contornada, campo dourado e botão verde com texto dinâmico.

## Fluxo

- Depois de autenticar, `/play` consulta o estado do jogador antes de iniciar o renderizador da sala.
- Sem nome confirmado, apresenta a escolha inicial com a sugestão editável **Meu Café**. Enter ou **Ok** confirma.
- O nome aceita de 1 a 40 caracteres Unicode visíveis; remove espaços externos e agrupa espaços repetidos. O servidor valida novamente.
- Depois da primeira confirmação, as próximas entradas seguem diretamente para o café.
- No próprio café, clicar no nome abaixo da satisfação reabre a tela. **Voltar ao café** cancela sem gravar. Essa edição usa `/play?renameCafe=1`; ao terminar, remove apenas esse parâmetro, preservando o destino da sala.
- A edição não abre enquanto outro modal ou a decoração estiverem abertos. Visitantes não recebem o clique de edição no nome.
- Ao salvar, o formulário impede envios repetidos. Falha de rede/servidor mantém o nome digitado e permite tentar novamente.
- `POST /api/coffe/cafe-name` usa a conta do cookie, limite de corpo e a verificação de origem existente. Recarrega o registro dentro da transação e altera somente nome e confirmação, preservando os recursos.
- Duas telas iniciais abertas: a primeira confirmação vence; a segunda recebe conflito e lê o nome já confirmado, sem sobrescrevê-lo. Edições posteriores explícitas continuam permitidas.

O painel de controles usa a mesma curva de abertura do menu de receitas (`ModalAnimation`); respeita a preferência por movimento reduzido. O cenário permanece estável durante a edição. Em telas com outra proporção, a composição é enquadrada sem cortes, e a sobra recebe as listras creme do loading: mesmas cores, largura e alinhamento à stage.

## Fundo clássico restaurado

Na revisão visual, a captura `codex-clipboard-e7adee40-c173-4a9f-900b-2fd3baa907df.png`, fornecida pelo responsável, passou a ser o fundo comum e o fallback. Ela tem o céu laranja, a chef ruiva e a personagem de óculos e roupa roxa. As imagens do portfólio continuam disponíveis para os temas, mas não substituem essa composição no acesso comum.

O Image Gen integrado reconstruiu exclusivamente as áreas cobertas pela frase, campo, botão e marcas antigas da captura. O empacotamento aproveita somente esses trechos: conserva os pixels do anexo fora da máscara e verifica essa igualdade antes da ampliação. Não usa uma nova geração para substituir rostos, personagens, logo ou cenário visível. Os trechos ocultos são uma reconstrução, não um original recuperado.

- Fonte preservada: `tools/cafe-name/classic-reference.png`.
- Retorno do Image Gen: `tools/cafe-name/classic-restoration-source.png`.
- Prompt: `tools/cafe-name/classic-background-prompt.txt`.
- Fundo sem controles, em resolução nativa: `game/public/assets/ui/cafe-welcome/cafe-classico-native.png`, 1151×825.
- Fundo de execução ampliado: `game/public/assets/ui/cafe-welcome/cafe-classico.png`, 3453×2475. Ampliação uniforme de 3× com Lanczos, sem inventar detalhes ou modificar o desenho.
- Máscaras, recorte e verificação: `game/public/assets/ui/cafe-welcome/classic-source.json`.

Para reexportar: `python tools/cafe-name/pack-classic.py` (Pillow e NumPy). O processamento mantém a fonte intacta.

Campo e botão usam os limites medidos na captura: campo 469×113 (4,1504:1), botão 153×79 (1,9367:1), com posição proporcional ao cenário. Não se impõe altura mínima que distorça essas proporções em telas pequenas. A área de toque do botão tem uma margem invisível adicional.

## Dados existentes

A migração `202610200002_cafe_name_onboarding.go` acrescenta `cafe_name_chosen`. Cafés com nomes personalizados existentes são considerados confirmados. O nome padrão provisionado, `Coffe Mania`, precisa de uma confirmação na primeira entrada após essa migração. É possível confirmar esse mesmo nome; o indicador separado evita perguntar novamente.

Não há alteração de saldos, inventário, móveis ou progresso. A escolha do nome não é uma condição de segurança para comandos do jogo: é uma etapa de apresentação do cliente.

## Arte reutilizada e reconstruída

Os wallpapers alternativos vêm de `artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance/artes/13020873/`, projeto **Color for Cafemania Artwork (Vostu)**, de **Pablo Andreetta**, conforme o catálogo local. A publicação do portfólio é de 11/12/2013; isso não data necessariamente cada ilustração ou evento.

| Arquivo do acervo | Uso | Asset de execução |
| --- | --- | --- |
| 007.jpg | Cozinha, fundo comum | cafe-cozinha.webp |
| 009.jpg | Encontro diante do café, fundo comum | cafe-encontro.webp |
| 008.jpg | Natal | natal.webp |
| 010.jpg | Páscoa | pascoa.webp |
| 013.jpg | Festa junina | festa-junina.webp |
| 005.jpg | Café na praia / verão | praia.webp |

As ilustrações existentes foram apenas convertidas para WebP, sem ampliar além da resolução de origem e com largura máxima de 1920 px. O arquivo `game/public/assets/ui/cafe-welcome/sources.json` registra origem, autor, hash de cada fonte e dimensões exportadas. Os originais do acervo foram preservados. Apenas o fundo escolhido é carregado.

O botão da tela usa `game/public/assets/ui/cafe-welcome/ok-button.png`, reconstruído com **Image Gen integrado** a partir do recorte `codex-clipboard-f317955e-61c1-44c3-b714-3db1724fcce9.png` fornecido pelo responsável: face verde viva, borda verde escura e sombra inferior, sem contorno dourado. A fonte gerada está em `tools/cafe-name/ok-button-source.png` e o prompt em `tools/cafe-name/ok-button-prompt.txt`. O PNG tem 612×316 (4× a medida de layout 153×79) e transparência real. **Ok**, o estado de salvamento, o nome e a frase continuam sendo texto de interface. O botão compartilhado dos temperos não foi alterado.

A moldura dourada é uma **reconstrução com Image Gen integrado**, baseada na captura histórica; não é um sprite original recuperado. O PNG de execução é `game/public/assets/ui/cafe-welcome/name-frame.png`; a imagem gerada original fica em `tools/cafe-name/name-frame-source.png` e o prompt completo em `tools/cafe-name/frame-prompt.txt`. O processamento só recorta a margem transparente e reduz a resolução. Não foram desenhadas peças ilustradas em SVG, CSS ou Graphics.

Reexportação, a partir da raiz:

```sh
python tools/cafe-name/pack-art.py --generated-frame tools/cafe-name/name-frame-source.png
python tools/cafe-name/pack-art.py --generated-button tools/cafe-name/ok-button-source.png
```

## Rotação e temporadas

Editar `game/public/assets/ui/cafe-welcome/catalog.json`:

- `defaultPool`: fundos comuns que entram na rotação. A revisão nostálgica mantém somente `cafe-classico`; a rotação volta a alternar se forem adicionados outros IDs à lista.
- `rotationDays`: número de dias por fundo; padrão 1. A troca acontece no próximo acesso, nunca por um temporizador enquanto se digita.
- `timeZone`: fuso do calendário visual; padrão `America/Fortaleza`.
- `activeSeason`: tema forçado (`natal`, `pascoa`, `festa-junina` ou `verao`), ou `null` para seguir o calendário e a rotação comum.
- `calendar`: períodos com datas completas, inclusivas, como `{ "season": "natal", "from": "2026-12-01", "through": "2026-12-26" }`. Esse exemplo é uma configuração possível, não um evento já agendado. Páscoa deve receber o período de cada ano.

Prioridade: tema forçado → primeiro período correspondente → rotação comum. O calendário vem vazio, sem ativar temporadas antes de sua definição. Esse calendário controla apenas ilustrações; não concede prêmios nem governa a simulação.

Se configuração ou tema estiverem indisponíveis, usa o fundo clássico. Se a imagem selecionada falhar, tenta o clássico uma vez. Não baixa todos os temas antecipadamente.

## Verificações realizadas

- `npm run typecheck`.
- `go test ./database -run '^TestCafeName' -count=1`: banco temporário, autenticação, origem, validação, persistência, proteção de primeira escolha, alteração posterior e isolamento entre contas/recursos.
- `node tools/cafe-name/verify-wallpapers.mjs`: virada de dia no fuso configurado, início/fim inclusivos de temporada, prioridade, fallback e existência dos arquivos.
- Chrome isolado: módulo real de entrada com API simulada e início da sala substituído para verificar o bloqueio até confirmar; erro/tentativa, envio repetido, recarga, edição/cancelamento, conflito entre abas, preservação do destino de visita e falha de imagem. Conferência dos temas em desktop e do enquadramento em celular.
- `RoomScreen` real em prévia isolada: clique no nome chama a edição para o dono; o mesmo clique em sala visitada não abre o editor.

Essa conferência de interface não representa uma sessão multiplayer completa. Capturas e relatório ficam em `.runtime/cafe-name/`, fora da entrega de código.
