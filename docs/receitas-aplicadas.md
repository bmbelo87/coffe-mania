# Receitas dos lotes 01–04 aplicadas

As 16 reconstruções revisadas foram exportadas para `game/public/assets/foods/<id>/stage_2.png`, com transparência, proporção preservada e quadro de 512×512. O livro usa as mesmas imagens do prato pronto no fogão, balcão, mesa e transporte. Os quatro pratos anteriores e o bolo legado foram preservados. São 20 receitas visíveis e uma receita legada fora do livro.

[Relatório de exportação, hashes e enquadramento](receitas-lotes-01-04.json) · [Pesquisa histórica e comparação das artes](../artes-referencia/receitas-cruzadas/index.html)

## Livro e preparo

Atualização: a aba Avançado pode ser consultada desde o nível1; os cartões bloqueados usam painel cinza, prato desbotado, cadeado raster e indicação do nível. Ver [referências visuais e comportamento dos NPCs](bloqueios-e-passagem-npcs.md).

Básico: Nachos, X-Tudo, Mousse, Churrasco, Pamonha, Tacos; segunda página: Vatapá, Mandioquinha, Arroz de Carreteiro, Quindim, Salada Caesar e Bolo de Cenoura. Avançado: Super À La Minuta, Carré, Torta, Lagosta, Batatas e Salmão; segunda página: Pimentão e Banana Split. `category` e `bookOrder` registram a sequência observada. Não ordenar por duração: isso colocaria as batatas e a torta fora da posição documentada. O vídeo não comprova a sequência completa de todas as edições.

Os novos pratos reutilizam durante o preparo a **panela tampada existente de Churrasco** (`stage_1.png`). É um substituto visual temporário, não a recuperação do preparo específico original. As artes prontas continuam diferenciadas por receita. Não foram criadas novas imagens nesta aplicação: as reconstruções de Image Gen existentes foram reaproveitadas.

O servidor confere o nível antes de debitar ouro ou criar o preparo. A interface explica o bloqueio por nível ou falta de ouro, inclusive em Favoritos. Custos, duração, porções, venda e XP continuam sendo regras do servidor. Não houve migração, alteração do banco real ou gravação de movimento. As recompensas futuras de nível passam a incluir os novos pratos por meio do catálogo; notificações já salvas não são recalculadas retroativamente.

## Valores provisórios explícitos

Estimativas de balanceamento autorizadas pelo responsável. Não são regras recuperadas do jogo original. Os valores conhecidos de tempo, XP e economia foram preservados; somente os campos sem evidência foram estimados.

| Receita | Campos estimados |
| --- | --- |
| Mandioquinha | Nível **5** |
| Arroz de Carreteiro | Nível **10**, custo **180**, **120** porções, venda **4** por porção; bruto480, líquido300 |
| Quindim | Nível **6**, custo **90**, **60** porções, venda **4** por porção; bruto240, líquido150 |

Cada campo estimado tem `provisionalRules.<campo>.value` e `.reason` no `recipe.json`. O marcador também é preservado nos catálogos sincronizados. O comentário `PROVISIONAL_RULES` em `tools/video-reference/register_recipe_lots.py` explica a origem. Os arquivos de pesquisa conservam `null` nas observações históricas; estimativas de execução não são retroativamente apresentadas como evidência histórica. Ao confirmar um valor, substitua o número no manifesto e remova somente seu marcador correspondente.

Versões escolhidas: Torta usa **270 porções**, custo130, venda2, líquido410 da ficha P076_03; a alternativa170/líquido210 permanece no acervo. Batatas usam **10 minutos** da ficha P076_05; os30min do vídeo ficam documentados como outra versão. Banana Split usa13h18 e os números associados às tabelas nominais/numéricas, com a inferência explícita em `source`. Valores anteriores do Churrasco não foram alterados.

## Atualização e verificação

Depois de editar um manifesto, execute `npm run assets:room`. Ele valida arquivos, números e os marcadores provisórios, sincronizando cliente e Go. Os servidores precisam recompilar para usar o catálogo embutido. O launcher de desenvolvimento acompanha esses manifestos; nenhuma outra cópia do projeto deve ser encerrada para isso.

O exportador `tools/video-reference/register_recipe_lots.py` reproduz o enquadramento deste lote a partir dos mestres preservados e recusa sobrescrever um manifesto divergente. O PNG não determina o nível de desbloqueio nem confirma a recuperação de uma arte original.

Verificações: validação do catálogo e TypeScript; testes focados do livro, sequência por categoria, nível/ouro e metadados provisórios; testes Go em banco temporário para preparo, tempo, custo, serviço, venda e bloqueio sem débito. A conferência no navegador usa `game/dev/recipe-book.html` com o modal real e estado simulado, em porta isolada. Ela verifica páginas e imagens, mas não comprova todas as sobreposições de uma sala multiplayer. Não foi feito build de produção nem encerrado um serviço preexistente.

Resultado: `npm run assets:room`, `npm run typecheck`, `node --test tests/unit/recipe-book.test.mjs` (2 testes) e `go test -p 1 ./database -run 'TestRecipe(Lots|Level)' -count=1` passaram; o primeiro teste Go percorre os16 pratos como subtestes. A compilação inicial excedeu a memória disponível; a execução sequencial com `GOMAXPROCS=2`, `GOMEMLIMIT=512MiB` e `GOGC=50` concluiu. A prioridade do bloqueio por nível foi corrigida para coincidir com a interface quando também falta ouro. A prévia na porta5186 foi encerrada ao fim da conferência.
