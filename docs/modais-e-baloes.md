# Abertura dos painéis e balões de pensamento

`ModalAnimation.ts` define a abertura compartilhada de 260 ms: escala inicial 0,7, fade e pequeno rebote, terminando em escala 1. Receitas, temperos, ferramentas de desenvolvimento, venda e expansão já usam essa curva. `PopupOpening.ts` aplica a mesma curva a configurações, sucos, subida de nível, guarda-roupa e loja. O editor HTML de cores amostra a mesma função pela Web Animations API.

A camada de animação conserva posição, escala e pivô do conteúdo. Seu pivô e sua posição têm o mesmo valor, tornando-a neutra ao terminar. O guarda-roupa mantém o cenário estático em cache e anima os controles e o personagem. Cada aviso consecutivo de nível reinicia a abertura. O ciclo de atualização do quarto avança as animações; o carregamento posterior da arte não as reinicia.

## Balão modular

`game/public/assets/ui/thought-bubble/` contém três PNGs transparentes gerados com Image Gen: oval, bolha maior e bolha menor. A origem e o prompt estão em `tools/thought-bubble/prompt.md`. Os ícones de bebidas existentes continuam separados.

`ThoughtBubble` recebe as três texturas e uma ação opcional. `setIcon(texture)` troca o conteúdo e preserva sua proporção dentro de 76×86 unidades do mundo; `setIcon()` deixa a moldura vazia. Pode receber texturas de café, comida ou outros pedidos sem alterar a moldura. Isso não acrescenta novos tipos de pedido à simulação do servidor.

`THOUGHT_BUBBLE_LAYOUT` concentra as medidas e os offsets. A origem fica no apoio da bolha inferior, acima da cabeça; a moldura mede 168×110 unidades. A hitbox acompanha o oval e os dois círculos, deixando livres os intervalos entre eles. Destruir uma instância preserva as texturas compartilhadas.

No quarto, o pedido de suco escolhe o primeiro sabor com estoque utilizável, a mesma escolha usada ao servir. Sem estoque, mostra laranja e mantém o aviso de preparo ao clicar. Respostas assíncronas antigas não alteram um pedido removido ou substituído. A posição acompanha o ator interpolado; a simulação e a referência lógica do movimento não mudam.

## Conferência

- `npm run typecheck` verifica os tipos.
- `node tools/popup-animation/verify.mjs` confere a curva, reabertura, transformação final, troca proporcional de ícones, hitbox, clique e preservação das texturas.
- `/dev/thought-bubble.html` oferece uma prévia com o personagem e conteúdos separados, sem servidor de jogo ou banco.
- A conferência em Chrome/WebGL isolado amostrou configurações, sucos, nível, guarda-roupa e loja em 0, 80, 180 e 260 ms. Esses quadros confirmam a apresentação isolada, não todas as condições de uma sala multiplayer ao vivo.
