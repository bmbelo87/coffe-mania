# Expansões do café e pátio

## O que as fontes mostram

| Fato | Fonte |
| --- | --- |
| O café inicial tem piso 6x9 | Informação do responsável pelo projeto, conferida na captura de 7/1/2014 |
| A loja tem a aba **Expansões** (ícone laranja de moldura recebendo um bloco de piso) com cartões em pares por tamanho: 7x9, 8x10, 10x11… Num café de nível 3, um 7x9 aparece "Disponível · 5 caféGranas · Comprar" e o outro "Não disponível" | Vídeo "Café Mania #2 Colocando Mesas e Cadeiras Novas" (Meme GamerCTZ) |
| A loja do segundo andar (2014) lista 7x9 por 20 caféGranas, 8x10 e 10x11 bloqueados | Acervo local, `imagens/segundo-piso/P121_14` |
| A janela "Comprar Expansão?" oferece 40000 caféOuros ou 10 caféGranas | Blog oficial da Vostu, 20/10/2010, `patio2.jpg` (Wayback Machine) |
| "Bloqueado! Desbloqueia no nível 15. Destrave antes! Desbloquear por 10"; outra versão pede 35 vizinhos e desbloqueia por 20 | Blog oficial, `patio5.jpg`; acervo local `P066_01` |
| O desbloqueio dispensa nível ou vizinhos, mas não o preço | Blog oficial, 22/10/2010 |
| A placa **"Terreno à venda"** fica no gramado; ao passar o mouse, o lote à venda aparece em verde com o balão "Clique para expandir seu Pátio!". O terreno é o **pátio**, área ao ar livre onde os clientes também comem, ampliada pela mesma placa em tamanhos fixos | Blog oficial, 20/10/2010; capturas enviadas pelo responsável |
| O pátio começa em **4x4**; depois vem um terreno de **7x6**. No lançamento eram só 2 expansões de pátio ("Por enquanto é possível fazer 2 expansões de Pátio") | Responsável pelo projeto; blog oficial, 20/10/2010 |
| "O tamanho máximo de um pátio é o mesmo que o do Café" e "Para que seus clientes entrem pelo Pátio, basta deixar uma entrada aberta" | Blog oficial, 20/10/2010 |
| Na versão nova, a expansão também se paga com Recomendações de Expansão mais caféOuros. As recomendações vêm de sucos, de presentes de vizinhos ou de troca por caféGranas | Blog oficial, 15/7/2011 e 2/9/2011 |
| Houve promoções de 50% (nov/2011) e 60% (mai/2012) nas expansões | Blog oficial |

Os posts do blog oficial (`blog.vostu.com/cafemania`) foram lidos pelo Wayback Machine. Nenhuma fonte lista os preços em caféOuros por tamanho, nem os níveis de cada etapa, nem os tamanhos depois de 10x11.

## O que está implementado

- **Café inicial:** piso 6x9 no layout de janeiro de 2014 (ver `docs/cafe-inicial-2014.md`).
- **Cartões:** a aba Expansões da loja mostra dois cartões por tamanho ainda não comprado, primeiro o de caféOuros e depois o de caféGranas. Só o próximo tamanho pode ser comprado.
  - O cartão de caféGranas não tem requisito.
  - O de caféOuros fica "Não disponível" abaixo do nível. Ao clicar nele, abre "Bloqueado!", com "Desbloquear por N" (cobra o desbloqueio em caféGranas mais o preço em caféOuros) ou o pagamento só em caféGranas.
- **Compra:** acontece numa transação (`database/expansions.go`), com a revisão do quarto e a chave da requisição; repetir o pedido não cobra duas vezes. O café ganha linhas e colunas nas bordas da frente, e os móveis não se movem.
- **Paredes e piso:** cada expansão completa paredes e papel de parede (continuando o papel do trecho anterior) e coloca o piso inicial nos tiles novos. Cafés expandidos antes dessa correção são reparados ao abrir o quarto.
- **Outros jogadores:** o servidor do jogo ajusta a grade de navegação e avisa os clientes, que recarregam o quarto com o tamanho novo.
- **Pátio:** a placa "Terreno à venda" (arte PNG em `game/public/assets/scenery/land-sale/`) vende o pátio.
  - **Onde fica:** abaixo da borda frontal esquerda do café, a partir da primeira coluna de piso. A coluna da parede não continua ao lado dele.
  - **Prévia:** com o mouse sobre a placa, aparece em verde liso exatamente o próximo terreno: o 4x4 inteiro, depois a parte em L que leva a 7x6. Fora disso, o chão fica limpo.
  - **Compra:** o clique abre "Comprar Expansão?" (caféOuros ou caféGranas) ou "Bloqueado!". Um terreno maior que o piso do café avisa "Expanda seu Café primeiro".
  - **Piso:** o pátio não tem paredes; os tiles comprados recebem piso de grama (`original_grass_floor`). Móveis e pisos podem ser colocados nele; janelas, painéis, papéis de parede e portas continuam só nas paredes do café.
  - **Clientes:** a navegação do servidor e do cliente cobre café e pátio, então os clientes sentam e comem no pátio, entrando pela porta do café.
  - **Expansão do café:** quando o café ganha linhas, o pátio e tudo o que está nele se deslocam junto com a borda.
  - **Na hora:** a compra aparece sem recarregar a página, como a expansão do café.

## Valores

| Etapa | Piso | caféGranas | caféOuros | Nível (caféOuros) | Desbloqueio |
| --- | --- | --- | --- | --- | --- |
| 1 | 7x9 | **5** | 40.000 | 15 | 10 |
| 2 | 8x10 | 10 | 80.000 | 20 | 15 |
| 3 | 10x11 | 20 | 150.000 | 25 | 20 |
| 4 | 11x13 | 30 | 250.000 | 32 | 25 |
| 5 | 13x14 | 45 | 400.000 | 40 | 30 |

- **Documentado:** os tamanhos 7x9, 8x10 e 10x11; os 5 caféGranas do 7x9. Os números 40.000 caféOuros, nível 15 e desbloqueio por 10 vêm da janela do pátio de 2010 e foram usados na primeira etapa.
- **Valores do projeto:** todo o resto. A tabela fica em `expansionSteps` e pode mudar sem migração.

### Valores do pátio

| Terreno | Piso | caféGranas | caféOuros | Nível (caféOuros) | Desbloqueio |
| --- | --- | --- | --- | --- | --- |
| 1 | 4x4 | **10** | **40.000** | **15** | **10** |
| 2 | 7x6 | 20 | 80.000 | 25 | **20** |

- **Documentado:** os tamanhos 4x4 e 7x6 (informados pelo responsável) e os valores em negrito. A janela de 2010 cobra 40.000 caféOuros ou 10 caféGranas e bloqueia no nível 15 com desbloqueio por 10. Outra captura de "Bloqueado!" desbloqueia por 20.
- **Valores do projeto:** o restante. A tabela fica em `patioSteps`.

## Pendências

- **Pátio:**
  - entrada direta da rua (hoje os clientes entram pela porta do café);
  - mureta e cerca com vão aberto;
  - piso de pedra do original;
  - terrenos depois de 7x6.
- **Recomendações e vizinhos:** recomendações de expansão e vizinhos ainda não existem; o nível faz o papel do requisito.
