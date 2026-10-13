# Expansões do café e terreno

## O que as fontes mostram

| Fato | Fonte |
| --- | --- |
| O café inicial tem piso 6x9 | Informação do responsável pelo projeto, conferida na captura de 7/1/2014 |
| A loja tem a aba **Expansões** (ícone laranja de moldura recebendo um bloco de piso) com cartões em pares por tamanho: 7x9, 8x10, 10x11… Num café de nível 3, um 7x9 aparece "Disponível · 5 caféGranas · Comprar" e o outro "Não disponível" | Vídeo "Café Mania #2 Colocando Mesas e Cadeiras Novas" (Meme GamerCTZ) |
| A loja do segundo andar (2014) lista 7x9 por 20 caféGranas, 8x10 e 10x11 bloqueados | Acervo local, `imagens/segundo-piso/P121_14` |
| A janela "Comprar Expansão?" oferece 40000 caféOuros ou 10 caféGranas | Blog oficial da Vostu, 20/10/2010, `patio2.jpg` (Wayback Machine) |
| "Bloqueado! Desbloqueia no nível 15. Destrave antes! Desbloquear por 10"; outra versão pede 35 vizinhos e desbloqueia por 20 | Blog oficial, `patio5.jpg`; acervo local `P066_01` |
| O desbloqueio dispensa nível ou vizinhos, mas não o preço | Blog oficial, 22/10/2010 |
| A placa **"Terreno à venda"** fica no gramado; o terreno é o pátio externo, ampliado em blocos pela mesma placa, nunca maior que o café | Blog oficial, 20/10/2010; capturas enviadas pelo responsável |
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
- **Placa "Terreno à venda":** fica no gramado junto à frente esquerda do café. Só com o mouse sobre ela aparece a prévia verde do terreno de 7x6. A compra do terreno ainda não existe.

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

## Pendências

- **Terreno (pátio):** compra pela placa (caféOuros ou caféGranas, com bloqueio e desbloqueio), piso de pedra, mureta com entrada aberta, navegação dos clientes e crescimento em blocos até o tamanho do café.
- **Recomendações e vizinhos:** recomendações de expansão e vizinhos ainda não existem; o nível faz o papel do requisito.
