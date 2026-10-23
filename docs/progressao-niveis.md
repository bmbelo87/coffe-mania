# Níveis, recompensas e popup de parabéns

## Evidências e limites

Foram consultados o acervo local, o XML em `ripped/game-config.xml.txt` e os relatos contemporâneos abaixo. O XML **foi modificado**: seus números são a base operacional desta edição, não uma configuração oficial intacta. Os relatos também divergem entre si e representam versões diferentes do jogo.

- [Lista completa de Níveis, 10/07/2010](https://jogandocafemania.blogspot.com/2010/07/lista-completa-de-niveis.html), fonte P107 do acervo: receitas e liberações de funcionários, fogões e balcões.
- [Dicas e Truques / lista de níveis, 10/07/2010](https://jogandocafemania.blogspot.com/search/label/Dicas%20e%20Truques): outra tabela de vagas de garçons, com aviso explícito de que atualizações poderiam alterar os níveis.
- [Tutorial de início, 04/11/2010](https://cafemvicio.blogspot.com/2010/11/): relato de nível 1 com título Chef Informal, 5.000 ouros, um garçom e Nachos de Queijo. Isso descreve o tutorial histórico; esta alteração não muda os recursos iniciais de desenvolvimento.
- Captura P022 do acervo, idêntica à referência fornecida: título Mestre do Churrasco, 20.000 ouros, Garçom x0 e +0 Pratos. O número do nível está borrado. **Associá-la ao nível 80 é uma estimativa**, pois 80 é o único nível com prêmio de 20.000 na tabela recuperada. Não foi encontrada uma tabela confiável com todos os títulos; outros níveis mostram a mensagem neutra Novo nível alcançado!.

O popup e os ícones foram reconstruídos com Image Gen. São aproximações raster da referência, com textos e valores dinâmicos. O cabeçalho, placa azul, moldura marrom, padrão claro, linhas de recompensa e botões seguem a disposição da captura. O texto quebrado `popup.levelUp.unlock` da imagem não é reproduzido: o jogo mostra os desbloqueios reais.

## CaféOuros e experiência

`requiredXp` é experiência **acumulada** para alcançar cada nível; `rewardCoins` é o ouro concedido nessa passagem. O servidor já pagava esses valores. O popup usa um recibo da mesma transação e não altera o montante nem exige clicar em receber.

| Nível alcançado | CaféOuros nesta edição |
| --- | ---: |
| 2 a 7 | 700 por nível |
| 8 a 18 | 900 por nível |
| 19 | 1.000 |
| 20 | 1.200 |
| 30 | 2.200 |
| 40 | 3.000 |
| 60 | 10.000 |
| 70 | 15.000 |
| 80 | 20.000 |
| 90 | 25.000 |
| 100 | 30.000 |
| 120 | 30.000 |
| 150 | 60.000 |
| 200 | 60.000 |
| 260 | 60.000 |

A tabela completa, incluindo os valores intermediários, está em `tools/level-up/level-rewards.csv` (260 linhas de níveis), derivada de `database/playerstate/levels.json`. Não se deve aplicar o prêmio de 20.000 a todos os níveis só porque aparece na captura. O limite desta edição continua sendo 260; o histórico teve outros limites.

## Garçons: vagas, não funcionários surgindo automaticamente

O XML recuperado contém `employees.amountLocks`, com esta capacidade total:

| A partir do nível | Total de vagas | Novas vagas nesta passagem |
| --- | ---: | ---: |
| 1 | 1 | 1 inicial |
| 7 | 2 | +1 |
| 15 | 3 | +1 |
| 23 | 4 | +1 |
| 31 | 5 | +1 |
| 39 | 6 | +1 |
| 47 | 7 | +1 |

Essa é a sequência escolhida para a edição atual. Há divergências importantes: P107 cita liberações em 7, 15, 23, 29, 36, 43 e 50; a outra postagem lista 3, 7, 15, 23, 37, 46, 50 e 59. Não há base para tratar uma dessas listas como válida para todas as épocas. O tutorial documenta a contratação escolhendo um contato do Orkut.

`Garçom x1!` no popup significa uma nova vaga, e o rodapé informa a capacidade total. A alteração expõe essa capacidade no estado do servidor, mas não implementa contratação social nem cria NPCs funcionários. Isso evita confundir uma liberação com um funcionário já contratado.

## Pratos e outros desbloqueios

Há duas coisas distintas nas fontes:

1. **Receitas liberadas ao subir de nível.** P107 relaciona novos pratos a vários níveis e, nos níveis mais altos, fogões, balcões e outros itens. Por exemplo, menciona Mousse de Maracujá/Pamonha no 3, Pizza/Empadão no 7 e Churrasco no 12. São regras históricas; o catálogo atual tem adaptações próprias.
2. **Prato surpresa de publicação social.** Em `newsFeedEvents.leveling`, o XML tem `rewardDish`, até dez cliques e duração 10080 minutos (sete dias). O relato do tutorial descreve publicações que compartilham brindes com vizinhos. Isso não prova que o dono recebia um prato surpresa automaticamente em cada nível.

Por isso, `+N Pratos` no popup conta as receitas com `inBook=true` liberadas exatamente naquele nível no catálogo atual (`shared/recipecatalog`). O rodapé lista seus nomes. Hoje há quatro receitas no livro: Nachos de Queijo, X-Tudo e Churrasco no nível 1; Mousse de Maracujá no nível 3. O popup do 3 mostra +1 Pratos; o do 7 mostra +0 Pratos. Não são inventadas receitas indisponíveis, porções prontas ou caixas de inventário para preencher a tela.

Como comparação, a lista histórica P107 nomeia **duas novas receitas por nível do 3 ao 9**, depois **uma por nível do 10 ao 32**. No 2 e do 33 ao 60, não nomeia novas receitas: cita itens, fogões, balcões e funcionários em determinadas passagens. Isso resume aquela publicação de julho de 2010, não uma regra universal para atualizações posteriores.

Não foram alterados os níveis das receitas nem acrescentados limites históricos de compra de fogões e balcões nesta alteração. A lista histórica permanece como referência para expandir o catálogo. O botão Compartilhar abre o compartilhamento do dispositivo, quando disponível, ou copia a mensagem. Não publica automaticamente nem simula brindes de uma rede social extinta.

## Funcionamento e verificação

- `GrantExperience` registra um recibo por nível alcançado junto com o ouro, na mesma gravação do estado. Um ganho que cruza três níveis gera três recibos.
- `level_notifications` é uma fila privada persistente, adicionada por migração. Jogadores existentes começam sem avisos retroativos. Reconexão ou recarga conserva os avisos ainda não confirmados.
- O cliente deduplica recibos recebidos por HTTP/SSE e os apresenta em ordem. Fechar confirma apenas aquele nível com cookie e verificação de origem; a confirmação é idempotente e não paga novamente.
- `SetLevel`/`SetExperience`, usados em ajustes administrativos, continuam sem conceder prêmios ou gerar recibos novos.
- Na máquina de sucos, as abas terminam em y=121 e o corpo começa em y=119. A faixa frontal do painel cobre os dois pixels de sobreposição, deixando as abas por trás da linha do corpo.
- `assets/ui/padlock.png` é o novo cadeado raster, usado tanto nas abas de sucos quanto no livro. Não há desenho do cadeado por SVG, CSS ou Graphics nesses locais.

Prévia isolada: `/dev/level-up.html` (ou `?view=juice`). As ações usam dados de prévia, sem acessar banco ou conceder recompensas reais. Capturas locais em `.runtime/level-up/preview-level80.png`, `preview-level7.png` e `preview-juice.png`, fora dos arquivos de entrega. As capturas e o teste no navegador não confirmam toda uma sessão multiplayer.

Verificações específicas: `npm run typecheck`; `node --test tools/level-up/level-rewards.test.mjs`; `go test ./database -run 'Test(LevelNotifications|LevelRewardWaiter|LevelAcknowledgement)' -count=1`. Os testes Go usam banco temporário para migração, fila, recarga, confirmação, repetição e proteção de acesso.

As imagens finais ficam em `game/public/assets/ui/level-up/` e `game/public/assets/ui/padlock.png`; fontes e prompts do gerador integrado estão em `tools/level-up/`. `pack-art.py` apenas recorta e reduz os ícones gerados, preservando desenho e transparência. A moeda reutiliza o atlas atual da interface.
