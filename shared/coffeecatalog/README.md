# Catálogo e regras de café

`catalog.json` contém os 16 sabores observados em `videos-jogo/Café Mania level 400.mp4`,
quadros de 103, 106, 110 e 114 segundos. A economia por serviço é transcrita desses
quadros; o HUD novo é visível, mas a data de publicação do vídeo não foi identificada.
O SHA-256 e os caminhos das capturas estão no próprio JSON.

Os valores de popularidade usam décimos inteiros no servidor. O contador servido
visível junto de “Dominado” não foi usado como limiar de domínio.

## Adaptações explícitas

As metas cumulativas `[20,50,100]`, a associação das três aparências a grupos
dominados, o limite de uma máquina por dono, a colocação gratuita e a recarga
de 4 caféGranas são provisórios e estão marcados em `provisionalRules`.

`MasteryLevel` retorna quantos patamares foram concluídos (0…3). Enquanto isso,
o painel pode mostrar nível 1 até20 serviços, nível 2 até50, nível 3 até100 e
“Dominado” a partir de100. O total servido não é zerado entre patamares.

A primeira aba está disponível; cada aba seguinte exige dominar todos os
sabores de todas as anteriores. A evolução visual vai de1 a2 após Básicos,
e de2 a3 após Médios. Dominar Avançados e Expert não cria uma quarta aparência.

## Contrato de execução

Selecionar sabor não custa energia e pode ser feito a qualquer momento. Não há
lote, porções, cozimento, expiração ou desbloqueio de20 caféGranas. O café padrão
de uma unidade sem seleção persistida é Espresso. O serviço usa energia, concede
ouro/XP/popularidade e incrementa o domínio em uma transação única.

GET `/api/coffe/coffees` responde com `selected`, `mastery`, `groups`,
`masteryThresholds`, `evolutionStage`, `playerState` e `rewards`. POST
`/api/coffe/coffees/{select,serve,recharge}` exige autenticação, mesma origem e
passa pela fila da sala. O servidor da sala confirma o cliente e substitui a
chave do serviço pelo nonce do pedido; a persistência rejeita reutilização da
chave com outro corpo e não cobra/paga novamente em uma repetição idêntica.

A energia usa **o mesmo** `juice_state.energy_at` que sucos e encomendas. Não há
relógio de energia adicional no estado do café.

## Prêmios de domínio — M06 pendente

Os nomes dos 12 prêmios antigos têm fonte oficial documentada no JSON. Ao dominar
um sabor com prêmio conhecido, `coffee_rewards` grava uma elegibilidade única por
dono/receita, com `delivered=false`. O snapshot apresenta o prêmio como pendente.
Nenhum item fictício ou móvel substituto é inserido no inventário. A entrega
depende do mapeamento do item real e de sua arte. Os quatro sabores Expert não
recebem nomes de prêmios inventados.
