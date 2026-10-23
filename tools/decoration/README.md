# Regressão do movimento na decoração

Execute na raiz:

```sh
node tools/decoration/verify.mjs
```

O teste usa os objetos reais do Pixi e carrega os módulos TypeScript com o esbuild já disponível no projeto. Não inicia serviços nem acessa banco. As texturas sintéticas não têm pixels, por isso esta verificação cobre o fluxo e as transformações, não a aparência final dos PNGs.

Cobertura: área interativa da loja durante a abertura e com escala do HUD, seleção de um móvel colocado, quatro rotações com troca de textura e pegada, colocação por clique, arrasto, Shift para girar, Escape para cancelar e recuperação após uma recusa simulada do servidor. O teste falhava antes da correção com `Cannot read properties of null (reading 'toLocal')`.

## Causa e contrato

A animação introduziu uma camada entre a raiz da loja e o painel. A consulta anterior por label examinava somente filhos diretos e retornava `null`. Ao pegar um móvel, a peça original já estava oculta quando a consulta lançava a exceção, interrompendo o desenho da prévia e seu acompanhamento do ponteiro.

`StoreActionBar` conserva agora uma referência direta ao conteúdo que define a hitbox. `toLocal` continua incluindo as transformações da animação, do HUD e dos ancestrais, sem depender da profundidade do painel na árvore de renderização.

A referência técnica consultada foi [RoomObjectEventHandler do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/RoomObjectEventHandler.ts): `setSelectedRoomObjectData`, `updateSelectedObjectData` e `resetSelectedObjectData` separam a seleção, a apresentação temporária e a restauração ao cancelar. Nosso `RoomStoreController` já mantém esse contrato; a falha estava na consulta à interface durante a atualização da prévia. A correção preserva esse fluxo e as validações do servidor, sem copiar algoritmos de projeção ou alterar a caminhada.

Também foi feita uma conferência isolada no Chrome/WebGL usando o `RoomScreen` real e os assets de cadeira estofada, mesa italiana e piano creme. Foram registrados 12 estados de rotação e nove comandos simulados de movimento, incluindo Shift e arrasto, sem erros no navegador. Quadros e metadados ficaram em `.runtime/decoration/`. Essa conferência não valida persistência em um banco real ou concorrência multiplayer.
