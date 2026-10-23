# Encostos e personagem sentado

Correção de 20/10/2026. A referência fornecida mostra o encosto da cadeira clássica atrás de um cliente sentado de costas para a câmera.

## Causa e contrato visual

`setSeatedActorRoomDepth` colocava o personagem depois da imagem inteira da cadeira. Isso serve às vistas de frente, mas esconde o encosto nas vistas traseiras. Inverter a ordem da cadeira inteira também seria incorreto: promoveria o assento sobre o corpo.

A ordem agora é **base/assento → ocupante → encosto traseiro**. As três camadas compartilham a pegada, o apoio e a âncora intrínseca da cadeira; usam deslocamentos de camada pequenos (0, +1, +2). A altura, o tamanho do PNG e suas margens não escolhem a profundidade.

`ChairBackrest.ts` reaproveita a própria textura montada da cadeira e aplica uma máscara funcional que isola encosto e hastes. Não gera nem redesenha pixels. `seatingBackrests` no manifesto registra os polígonos nas coordenadas da pose montada, incluindo o espelhamento. Esse é um dado de calibração da arte, não uma exceção na ordenação global. `tools/seating/calibrate-backrests.py` mantém os registros editáveis dos sete modelos do catálogo.

As rotações 0/1 mantêm o assento e o encosto da imagem-base atrás do ocupante. Nas rotações 2/3, a camada do encosto fica visível somente enquanto houver um personagem sem passo ativo nos estados `seated`, `eating`, `thirsty` ou `drinking` naquela cadeira. Ao levantar, sair, entrar na decoração ou remover a cadeira, a camada deixa de participar. Atores continuam usando a referência da cadeira durante a postura; ao levantar retornam à profundidade normal.

Posição, direção, quadros de animação, projeção e troca de tile lógico na metade do passo foram preservados. Não há novas gravações de movimento ou alteração da simulação Go.

## Referência técnica

O [FurnitureVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts) resolve a direção e calcula profundidade relativa por camada, separadamente dos offsets da imagem. O [AvatarVisualization](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/avatar/AvatarVisualization.ts) trata postura, offsets e profundidade do avatar em contratos próprios. Aqui esse princípio se traduz em camadas intrínsecas sobre a geometria compartilhada da cadeira; os algoritmos e sinais de profundidade não são copiados do Nitro.

## Verificações

- `node tools/seating/verify-depth.mjs`: frente e costas, cache entre quadros, diferentes pegadas/âncoras, vizinhos, levantamento e preservação da interpolação/troca de tile na metade do passo.
- `npm run assets:room`: 51 itens e cinco receitas; valida os novos metadados de encosto.
- `npm run typecheck`.
- Chrome/WebGL isolado: cadeira clássica e estofada com dois looks reais, nas quatro rotações, sentado e comendo. A comparação registra tile lógico, posição, direção, clipe, frame e tempo da animação, conservados entre os quadros.
- `RoomScreen` real em fixture: encosto ativo ao sentar, comer, esperar suco e beber; inativo ao levantar, iniciar passo ou entrar na decoração.

As máscaras foram cadastradas para os sete modelos; a comparação visual detalhada usou dois deles. As capturas em `.runtime/seating/` não representam todas as sobreposições possíveis de uma sala multiplayer.
