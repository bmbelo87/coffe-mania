# Limpeza dos revestimentos — 25/10/2026

Concluída a revisão das 47 superfícies `behance_*` ativas: nove pisos e uma parede corrigidos, com os outros 37 revestimentos preservados. A revisão considera apenas as imagens referenciadas pelos manifestos, não PNGs antigos que não entram no jogo.

As salas vêm do [portfólio CAFEMANIA, Walter Ávila e Andrés Guerrero](https://www.behance.net/gallery/9287765/CAFEMANIA), projeto 9287765 no acervo local. Os itens mantêm a página, imagem, hash e sala de origem no `source`. São extrações de imagens de divulgação ou reconstruções identificadas, não PNGs originais recuperados.

## Resultado

| Item | Correção e origem final |
| --- | --- |
| Piso Clássico | Faixas originais livres das células (2,4) e (1,7); removidos fragmentos vermelhos/amarelos. |
| Piso Egípcio | Célula original (3,3), conservando as pedras e removendo os fragmentos azulados no rejunte. |
| Piso Oriental | Extração original conservada fora dos resíduos; reconstrução localizada por ImageGen nos rejuntes, bordas e pequenos fragmentos. |
| Piso Azulejos Azuis | Célula original (4,7), com reconstrução localizada nas bordas direita e inferior. |
| Piso Lilás Quadriculado | Extração conservada fora das máscaras; ImageGen somente nos confetes e fragmentos periféricos. |
| Piso Xadrez Verde | Metades livres das células (1,5) e (1,4), sem a faixa do piso marrom ou partes da planta. |
| Parede Céu e Morros | **Master integral gerado e aprovado pelo responsável**, projetado na face existente; remove os resíduos do rodapé e da lateral direita. |
| Piso Talavera | Célula original (7,0), sem fragmentos de louça ou móveis. |
| Piso Medalhão Azul / Paris Azul | Célula original (9,3), fase deslocada para centralizar a lajota inteira; pequeno resíduo escuro à direita corrigido por ImageGen. |
| Piso Rosa dos Ventos | Célula original (3,5), com reconstrução localizada no canto inferior direito; o motivo central permanece extraído da fonte. |

O consenso por pixel pode conservar pequenos fragmentos quando há poucas amostras livres, células de outro piso no conjunto ou linhas desalinhadas que deixam de obter votos. `rooms.py` agora aceita regiões visualmente revisadas por célula: pontos fora dessas regiões não votam. A configuração também permite corrigir a fase da textura sem deslocar seu tile e aplicar apenas os trechos aprovados de um master gerado.

A última revisão de Céu e Morros usa a arte inteira solicitada pelo responsável. As versões intermediárias, que tentavam conservar o céu extraído e corrigir somente o rodapé, foram substituídas. Foi corrigida também a seleção do último pixel da borda: coordenadas limitadas a 1 precisam entrar em uma máscara que chega ao fim da textura; caso contrário, sobra uma linha de pixels antigos na suavização da base.

## Arquivos e reprodução

- [Regiões e fase de cada reparo](../tools/surfaces-behance/repairs/reviewed.json).
- [Gerações, prompts e decisões de uso](../tools/surfaces-behance/repairs/generations.json). Foi usado o ImageGen integrado. Os masters selecionados estão na mesma pasta; gerações rejeitadas não entram no jogo.
- [Auditoria das superfícies ativas](../tools/surfaces-behance/audit.py) e [pranchas das células originais](../tools/surfaces-behance/candidates.py).
- [Prévia e aplicação dos reparos](../tools/surfaces-behance/restore-review.py): sem argumento apenas cria a revisão; `--write` grava os dez itens revisados. Não apaga PNGs antigos e guarda cópias da situação anterior em `.runtime/surface-cleanup/before/`.

Os pisos continuam em 162×82 px, registro (-81,-1), e a parede em 80×248 px, registro (-80,-168). Alfa, IDs, preços, nomes, pegadas e período geométrico medido foram preservados. Em Paris Azul, a fase altera somente onde começa o desenho dentro da textura, mantendo a grade e a origem do objeto.

## Verificação

- Comparação ampliada antes/depois e repetição 3×3 dos pisos, além da parede repetida: `.runtime/surface-cleanup/comparison.jpg` e `repeated.png`.
- Seis regressões específicas de regiões livres, falha por falta de amostras, máscaras localizadas em piso/parede e fase da textura; dois testes de superfícies do cliente.
- Dimensões e alfa dos dez reparos idênticos aos anteriores; contratos dos itens e registros dos 47 revestimentos preservados; pixels das outras 37 superfícies inalterados.
- `npm run assets:room`: 99 itens, 21 receitas e 16 cafés.

Nenhum servidor ou banco foi iniciado. Esta é uma conferência de arte e projeção offline, não uma sessão multiplayer ao vivo. A resolução das capturas continua limitando o detalhe extraído; as regiões reconstruídas são aproximações identificadas. E02/E03 mantêm o andamento anterior.
