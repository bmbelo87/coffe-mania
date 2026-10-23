# Satisfação, popularidade e a carinha da interface

Pesquisa de 21/10/2026. Escopo: consultar acervo, vídeo local, blogs contemporâneos e suporte oficial arquivado. A pesquisa não altera a economia, os limites ou a expressão da barra.

## Resultado

Há evidência para **+0,1 por atendimento satisfeito** e **−0,3 por cliente que sai insatisfeito**. Falta de comida pronta e de assento disponível causa insatisfação; popularidade maior aumenta a frequência de clientes. Esses valores já são usados pelo jogo atual.

**Não foi confirmado o corte numérico para cada expressão do HUD original.** Não é seguro concluir que 8,2 deveria mostrar sorriso, nem que o vermelho atual reproduz a regra original. Também não foi comprovado que a carinha mostra tendência recente, o último cliente ou um intervalo de tempo em vez da nota absoluta. Essas possibilidades permanecem hipóteses, não regras implementadas.

## Evidências e versões

| Fonte | Evidência | Limite |
| --- | --- | --- |
| [FAQ — Jogando o Café Mania](https://jogandoocafemania.blogspot.com/p/faq.html) | Registra ganho de 0,1 por cliente satisfeito e perda de popularidade quando falta mesa | Não especifica os cortes das expressões |
| [Como funciona a popularidade — 02/11/2010](https://thecafemania.blogspot.com/2010/11/como-funciona-popularidade.html), P049 | Registra perda de 0,3; relaciona a insatisfação a comida/mesa e a popularidade ao fluxo | Relato contemporâneo, não código oficial |
| Acervo P115, `imagens/interface-eventos-guias/P115_01_105_73ea66e4.jpg` | Captura com 105,0 e sorriso no HUD antigo | Um único ponto não determina uma curva completa |
| Acervo P031, `imagens/interface-eventos-guias/P031_01_bugcafemania_88954014.jpg` | Captura com 83,9 e sorriso | Não é exemplo de sorriso com nota muito baixa |
| Vídeo local `cafe mania muito tempo de jogo.mp4`, 00:25 | Mostra 106,7/160, estrelas e sorriso na barra inferior | Versão posterior; 106,7 é cerca de 66,7% de 160. Não comprova sorriso em 8,2/105 |
| Suporte oficial arquivado “Saiba tudo sobre a popularidade de seu Café”, atualizado em 22/11/2011 | Estrelas em 100, 135, 200, 350 e 500 sorrisos; continuidade do atendimento, bebidas e itens abastecidos após a primeira estrela | Descreve outra fase do jogo. Não fixa os cortes das carinhas nem o limite 160 visto no vídeo |
| Blog oficial arquivado, “O Café mais popular”, 15/11/2011, e “Café de Luxo”, 20/06/2012 | Apresenta a progressão por estrelas e a participação de bebidas e itens Star na popularidade | Não deve ser aplicado automaticamente à edição clássica 0–105 |
| `ripped/game-config.xml.txt` | Contém mínimo 5, máximo 105, passos 0,1/0,3 e tabela de frequência | Arquivo adulterado: cada regra precisa ser corroborada; não comprova limites visuais do HUD |

Uma nota abaixo da meta seguinte de estrelas não equivale automaticamente a clientes muito insatisfeitos. Esta é uma distinção entre as métricas, não uma comprovação da fórmula gráfica usada em todas as versões.

O tutorial [Café Mania Vício, 04/11/2010](https://cafemvicio.blogspot.com/2010/11/tutorial-cafe-maniacomo-comecar-jogar.html) descreve a contratação do primeiro empregado durante o tutorial e uma vaga no nível 1. Isso reforça a divergência com o relato de primeiro garçom no nível 3 registrado na pesquisa anterior, mas não confirma contratação automática.

## O que o projeto faz hoje

- Usa pontos em décimos: +1 décimo ao consumir a refeição, −3 décimos ao registrar a saída sem comer; uma visita não pode receber o mesmo julgamento duas vezes.
- Limita a nota entre 5 e 105, com valor inicial 80. Os limites vêm da configuração disponível; o valor inicial é uma escolha atual do projeto, não um número histórico confirmado nesta pesquisa.
- Relaciona a frequência de chegada à popularidade. A tabela de referência vai de 5 a 25 clientes/minuto antes dos bônus de nível; os bônus têm interpretação própria documentada no código.
- Clientes aguardam comida por 30 segundos. O próprio código registra esse tempo como decisão desta edição. Não é um prazo histórico confirmado.
- O HUD divide `current / maximum` em dez faixas iguais. Abaixo de 50% usa cinco imagens de insatisfação em ordem inversa; acima usa cinco de satisfação. A carinha vermelha em 8,2/105 resulta dessa divisão.
- As imagens vêm do mesmo atlas usado nas reações animadas dos clientes. Ter dez imagens nesse atlas não comprova que o HUD original usava dez faixas iguais. A regra foi marcada `PROVISIONAL` em `ActionBarMood.ts`.
- O projeto ainda não implementa a progressão posterior por estrelas. Nenhum limite dessa fase foi aplicado nesta pesquisa.

## Fontes preservadas

O acervo Pxxx fica em `artes-referencia/cafe-mania-acervo-documentado/cafe-mania-acervo/`.

Os arquivos primários locais consultados estão no acervo externo já disponível:

- `C:/Users/Ulisses/Desktop/Projetos/Projeto-Cafe-Arquivo/CafeMania-Clone/Acervo-CafeMania/04_paginas_arquivadas/cafe_mania/vostu_geral/support/cafemania-2/saiba-tudo-sobre-a-popularidade-de-seu-cafe.html` e a captura `__w20120222.html`.
- `C:/Users/Ulisses/Desktop/Projetos/Projeto-Cafe-Arquivo/CafeMania-Clone/Acervo-CafeMania/06_inventario/blog_cafe_mania_posts.md`.

O endereço original do suporte era `http://www.vostu.com/support/cafemania-2/saiba-tudo-sobre-a-popularidade-de-seu-cafe/`. O acesso direto não foi recuperado; foi utilizada a cópia local, não uma página atual do domínio. As páginas diretas de P102/P115 também não abriram na consulta; suas capturas locais estão identificadas acima. Não foram acessados desafios de CAPTCHA.

O quadro nativo do vídeo, o recorte de leitura e os hashes estão em `artes-referencia/popularidade/`. Recortes/ampliações desse diretório são referências, não arte de execução.

## Próximo ajuste proposto para a satisfação

1. Obter pelo menos uma sequência em que o número esteja baixo e a expressão do HUD esteja legível. Registrar edição, nota, denominador e mudanças antes/depois de atender clientes.
2. Distinguir o ícone da barra da reação sobre a cabeça de um cliente. Um cliente feliz pode coexistir com uma reputação acumulada baixa; isso não comprova, sozinho, a expressão global da barra.
3. Separar nota clássica e meta de estrelas no modelo antes de implementar a fase posterior. Não usar apenas o percentual da próxima estrela como prova de satisfação.
4. Com evidência suficiente, apresentar os cortes/estados escolhidos e os assets reutilizados antes de mudar o HUD. Sem essa confirmação, manter a regra provisória visível no código e a lacuna no plano.

Nesta etapa, a alteração funcional foi a variedade dos garçons. Os números e o ícone de satisfação permaneceram iguais.

### Evidência adicional localizada em 22/10/2026

Durante o levantamento da orla, a prancha `artes-referencia/cafe-mania-acervo-complementar-2/cafe-mania-acervo-2/artes/49023909/002.png`, de [Erica Perez](https://www.behance.net/gallery/49023909/Cafe-Mania-Vostu), foi inspecionada em resolução nativa. A captura embutida exibe **50,7** ao lado de uma **carinha amarela sorridente** no HUD do café “Comes e Bebes”. Não há denominador legível nesse painel. Isso confirma outra associação histórica de número/expressão, porém não fixa os cortes do HUD, sua dinâmica ou o máximo daquela edição; também não comprova sorriso com uma nota tão baixa quanto 8,2. Não alterar as faixas a partir de um único ponto.
