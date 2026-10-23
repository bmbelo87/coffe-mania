# Coleta dos garçons e entroncamento da rua

## Garçons

`game-server/gameruntime/waiters.go` já enumerava as quatro bordas da pegada, mas comparava o número de passos e escolhia o destino antes de considerar outros atores. Rotação visual não limita o lado de coleta.

Agora a escolha compara a duração/distância de caminhada, usando a mesma proporção entre passo reto e diagonal do runtime, e prefere um acesso com caminho livre de personagens. Se todos estiverem ocupados, mantém a melhor rota geométrica para a espera/travessia já existente. Só a ausência de caminho por geometria permite o cerco clássico com entrega instantânea. Reservas, cobrança na entrega e troca do tile lógico na metade do passo foram preservadas.

Regressões específicas: coleta por cada lado em quatro rotações; acesso livre em lugar do lado ocupado; caminhada com prato; cobrança única; cerco por móveis; personagens não provocam teleporte; reserva exclusiva; restauração e mudança de aparência sem resetar tarefa. Executado:

```text
go test -p 1 ./gameruntime -run 'TestWaiter|TestTrappedWaiter|TestEmployeeRoster|TestActor' -count=1
```

Resultado: passou. Não foi feita uma conferência visual dos garçons em conta real nesta etapa.

## Rua

A falha já estava nos PNGs, não na ordenação dos sprites ou no filtro de textura. O ramo refletido encobria partes das faixas da outra direção e o recorte da calçada atravessava o encontro das duas ruas. A divisão dos PNGs em x=0 não era, por si só, a causa.

Foi localizado o vetor **Road, character 2055, de `game_asset.swf` do Restaurant City** no acervo técnico externo. Os IDs de cenário no manifesto antigo estavam associados ao arquivo de origem errado (`indoor_asset.swf`). Isso não é descoberta de um SWF do Café Mania. A rua atual continua sendo o cenário técnico existente, enquanto o cenário fiel do Café Mania está no plano da orla.

O vetor editável foi reexportado com JPEXS 26.3.0 a 2×. `tools/street-scenery/build_junction.py` recompõe os caminhos nativos: união do asfalto, calçadas em seus respectivos lados e retirada de subcaminhos inteiros de faixas dentro do entroncamento. `export.mjs` rasteriza um único master e recorta nas duas texturas existentes, preservando tamanho e offsets. Não houve redesenho ilustrado em SVG nem geração de arte nova; os caminhos de rua, calçada e bueiro vêm do vetor existente. Nenhum Image Gen foi necessário para essa correção.

Fontes preservadas, hashes e área de alteração: `tools/street-scenery/source.json`. O patch ocupa `[-340, -1400, 1990, 2200]` em coordenadas do cenário; os pixels fora dessa área foram comparados com os masters anteriores e permanecem idênticos. Os arquivos West e FarEast não foram alterados.

Para reproduzir com Python e Sharp disponíveis:

```text
python tools/street-scenery/build_junction.py
node tools/street-scenery/export.mjs
```

`SHARP_MODULE` pode apontar para o Sharp do runtime empacotado. Não é dependência nova do cliente. A procedência distingue o vetor nativo e os PNGs de composição anteriores.

Referência técnica consultada: [RoomPlane do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/room/RoomPlane.ts), que mantém origem, lados, offsets e máscaras ligados à geometria. Aqui a correção segue esse princípio na preparação da composição; o cliente continua exibindo sprites, sem adotar o rasterizador de planos do Nitro.

Verificações realizadas: `npm run typecheck` passou; imagens 3200×3600 preservadas; zero pixels alterados fora do patch; duas faixas inteiras no recorte analisado, sem os fragmentos pequenos anteriores; conferência WebGL em `game/dev/street.html`, com os assets reais e `createSceneBackgroundView`, nos zooms 0,55, 1 e 2,40. A prévia é isolada e não comprova todas as posições da câmera da sala ou expansão de terreno. Screenshots locais em `.runtime/street/`.

Os serviços do projeto foram iniciados novamente após confirmar as portas livres. Não foi usado banco temporário para inicialização de teste: foi reaberto o ambiente normal solicitado para teste manual, preservando seu banco existente. Nenhuma suíte completa ou build do cliente foi executado.
