# Decoração e circulação externa — 22/10/2026

Comportamento solicitado para o runtime compartilhado atual. Não é uma confirmação documental de todas as versões históricas do Café Mania. Reutiliza os assets existentes; nenhuma arte foi criada neste lote.

## Mesa ocupada

Ao selecionar uma mesa colocada no modo decoração, o cliente aguarda a confirmação do servidor antes de mover, girar, guardar ou vender a peça. O dono da sala pode liberar a mesa mesmo com o chef trabalhando. Jogadores humanos sentados continuam protegidos.

O servidor remove os clientes vinculados à mesa, inclusive reservas de quem estava indo sentar, libera cadeiras e interrompe entregas de garçons destinadas a eles. A remoção não produz avaliação negativa nem animação de saída. Enquanto a mesa está na mão do jogador, novas reservas são recusadas. Colocar, guardar, vender, cancelar, trocar de seleção ou fechar a decoração libera essa reserva.

Cada cliente que ainda estava comendo devolve uma porção. A devolução usa uma transação e um comprovante por cliente; repetir a confirmação não duplica o estoque. Se a persistência falhar, o cliente permanece na mesa com seu prato e a movimentação da mesa é recusada para permitir nova tentativa segura.

A venda já é creditada na entrega do prato. Por isso, `room_food.prepaid_portions` marca porções devolvidas que já renderam ouro, XP e popularidade. Essas porções são consumidas primeiro e não pagam novamente. O XP das porções normais continua no estoque e é distribuído normalmente.

A porção acumula no balcão que contém a mesma receita ou ocupa um balcão vazio. Caso todos os balcões estejam ocupados com outras receitas, fica preservada como estoque sem balcão associado, usando o atendimento legado já suportado pelo servidor. Nesse caso ela não tem pilha visual no balcão, mas pode ser servida; a decoração não é bloqueada e o prato não é perdido.

## Porta e calçadas

`DoorView` recebe uma indicação local de decoração e fecha imediatamente a folha, inclusive no meio da abertura. Os clientes continuam simulados normalmente e a porta volta à animação usual ao sair desse modo.

Entradas e saídas escolhem entre três extremidades externas: os dois extremos do passeio à esquerda e o extremo do passeio à direita. A escolha independe da parede onde está a porta. A mudança de passeio passa pelo canto externo `(-1,-1)`; rotas não cortam o gramado nem o interior do café.

Referência técnica consultada: [MovingObjectLogic do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/logic/MovingObjectLogic.ts). Ele distingue atualizações de localização da interpolação visual. Aqui o servidor continua responsável pelos caminhos e o cliente pela apresentação; a troca do tile lógico na metade do passo foi preservada. Os algoritmos de navegação dos projetos não são tratados como idênticos.

## Verificação executada

- `npm run typecheck`: passou.
- `node --test tests/unit/decoration.test.mjs`: quatro testes passaram; fechamento imediato da malha, espera pela liberação da mesa, confirmação concorrente, cancelamento, fechamento e falha de devolução.
- Em `game-server/`: `go test ./gameruntime -run 'TestDecoration|TestSidewalk|TestWaiter|TestCustomers|TestActorObstruction|TestDoor' -count=1 -timeout=60s`: passou, com casos novos de reserva da mesa, remoção sem julgamento, retorno de prato, erro de persistência, proteção de outros jogadores e rotas externas nos dois sentidos.
- Em `database/`: `go test . -run 'TestReturnedMeal|TestMousseGoesToCounterAndPaysPerPortion' -count=1 -timeout=60s`: passou usando bancos temporários, incluindo repetição após consumo, criação da última porção e balcões cheios.
- `/dev/decoration-door.html`: conferência visual da arte e malha reais em navegador com WebGL, comparando porta aberta com porta forçada fechada, sem conta ou conexão com o banco.
- Servidor local consultado em `/game/health`: respondeu `ok`; o launcher recarregou os serviços após as mudanças.

A conferência visual isolada valida a apresentação da porta. Não substitui uma sessão manual com vários jogadores decorando a sala simultaneamente.
