# Café Mania — Alpha 0.5.0

Este projeto é uma versão feita por fãs com o objetivo de recuperar o jogo **Café Mania**.

Esta versão já contém bases relativamente sólidas para você criar o seu próprio projeto — use da forma que achar melhor — ou, se preferir, contribuir com esta versão para ajudar a alcançar o resultado final.

Os arquivos presentes neste repositório contemplam:

- Backend
- Banco de dados
- Client
- Servidor WebSocket do jogo
- Ferramentas para preparar assets

As mudanças de cada versão estão no [CHANGELOG](CHANGELOG.md).

## O que já está "pronto"

### Primeira entrada

Depois do login, o jogador escolhe o nome do café numa tela de boas-vindas inspirada na original, e já começa com um chef de uniforme azul. O nome pode ser trocado depois, clicando nele dentro do café.

### Cozinha

O Livro de Receitas tem 20 pratos, em abas Básico e Avançado. As receitas acima do nível aparecem bloqueadas, com cadeado.

O chef anda até o fogão e prepara o prato. Quando fica pronto, leva para o balcão. Fogões ficam sujos e precisam de limpeza. Os pedidos de cozinhar, limpar e servir entram numa fila.

Há também temperos, que melhoram o prato no fogão.

### Clientes e garçons

Os clientes chegam pela rua e pela praia, escolhem uma mesa e esperam o prato. Quem come paga e aumenta a popularidade; quem sai sem comer diminui.

Os garçons, contratados pela janela Empregados conforme o nível, buscam a comida no balcão e servem as mesas.

### Progressão

O jogo tem XP e níveis, com a curva do `game-config.xml`. Cada subida de nível mostra a janela "Parabéns!!!", com as recompensas e as receitas liberadas.

### Máquina de Sucos

A máquina é comprada na loja e destravada com o chaveiro. Prepara sucos para os clientes que pedem um depois da refeição.

### Loja, decoração e expansões

A loja permite comprar e posicionar móveis, girar, guardar e vender pela caixa registradora. Há itens animados, como a Vovó Chef e o Pequeno Bruxo.

O café pode ser expandido até 13x14. Também dá para comprar um pátio ao ar livre pela placa "Terreno à venda".

Também foram adicionados atalhos para tornar a movimentação e a utilização da interface mais ágeis.

### Guarda-roupa

O guarda-roupa já está funcional, permitindo trocar de roupas e personalizá-las como preferir.

Essas preferências são salvas e permanecem durante toda a utilização.

Como funcionalidade extra, também foi adicionada a opção de **cores personalizadas**.

### Cenário

O café fica na orla da cidade, com mar, areia, píer com lancha, calçadas, rua e árvores. Tudo é montado em partes independentes, para que cada peça possa ser trocada sem refazer o resto.

### Amigos

A função de amigos ainda não está pronta, mas já é possível visitar os cafés de outros jogadores em tempo real.

### Interface

A interface se encontra em um estágio intermediário de desenvolvimento, tanto em UI quanto em SFX, buscando manter um visual o mais fiel possível ao jogo antigo.

### Backend

O servidor WebSocket do jogo cuida da simulação compartilhada de cada café: clientes, garçons, movimentos e animações. O banco de dados (PocketBase) guarda o que precisa durar: contas, compras, inventário e progresso. Os dois já estão relativamente funcionais.

### Modo de desenvolvimento

Com o modo dev ligado nas Configurações, um menu permite ajustar recursos, terminar ou sujar fogões, colocar pratos nos balcões, chamar clientes e recomeçar o café do zero. É útil para testar sem esperar o tempo do jogo.

## Conteúdo

Os conteúdos presentes no projeto são limitados em quantidade de itens, sendo necessário processar assets adicionais para expandir o conteúdo disponível.

Para esse processo, é recomendado utilizar uma cadeia de ferramentas envolvendo **IllustrationJAnAI** e **Photoshop** para auxiliar na recuperação e no tratamento dos assets.

O projeto também inclui ferramentas na pasta `tools`, que auxiliam no processo de recuperação e preparação dos conteúdos:

- Uma ferramenta para **recortar itens de imagens**;
- Uma ferramenta para **posicionar os itens corretamente**;
- A ferramenta **Twister**, que permite distorcer texturas para facilitar o processo nos dois sentidos;
- O **video-to-item**, que extrai itens animados de vídeos.

A **Twister** pode ser utilizada, por exemplo, para transformar pisos e paredes em texturas planas ou realizar o processo inverso, facilitando a adaptação dos assets para utilização dentro do jogo.

Parte das artes recentes foi reconstruída a partir de capturas do jogo original. Os documentos em `docs/` indicam o que é reconstrução e qual referência foi usada.

## Como rodar

Requisitos: Node.js 24+, npm e Go 1.27+. Na raiz do projeto:

```sh
npm ci
npm run dev
```

Depois, acesse http://localhost:5173/ e entre com a conta de desenvolvimento `test@local.mail`, senha `123456`. Ela é criada automaticamente num banco novo.

Mais detalhes sobre portas, configuração e ferramentas estão no [AGENTS.md](AGENTS.md).

## Estado do projeto

O projeto se encontra atualmente em **Alpha**, recebendo atualizações esporádicas.

As versões seguem o formato `0.X.Y`:

- `0.5.0` é um lote de funcionalidades;
- `0.5.1` é uma atualização pequena;
- `0.5.11` é uma correção pontual sobre a `0.5.1`.

O [CHANGELOG](CHANGELOG.md) explica a regra completa.

Todo o conteúdo presente neste repositório é de livre acesso. Use como bem entender.

Para usuários de agentes de IA, o projeto conta com arquivos em Markdown contendo explicações para colocar o projeto em funcionamento.

> **Esta versão NÃO É plug and play.**

Isso significa que você não encontrará um `.exe` para simplesmente abrir e começar a testar.

No entanto, com a ajuda de um agente de IA, a experiência pode chegar bem perto disso.

## Imagens

### Jogo

![Jogo](https://i.imgur.com/03svVnH.png)
![Jogo](https://i.imgur.com/qtBNaEI.png)

### Guarda-roupa

![Guarda-roupa](https://i.imgur.com/pxXtrIP.png)

### Loja

![Loja](https://i.imgur.com/n7qWyF7.png)

### Tela de carregamento

![Tela de carregamento](https://i.imgur.com/Q1JV8UD.png)

![Tela de carregamento](https://i.imgur.com/rLntJHe.png)
