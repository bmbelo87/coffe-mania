# Personagem inicial e fallback

O cliente usa `game/public/assets/avatar/placeholder/starter-atlas.png` e seu JSON enquanto a aparência individual está pendente ou indisponível. O carregamento passa por `AVATAR_PLACEHOLDER_URLS` e `loadPlaceholderAvatar()`; não depende de preparar o modelo 3D na entrada da sala. A aparência salva do jogador continua assumindo o lugar do fallback quando estiver pronta.

Novos jogadores também recebem essa combinação como **aparência inicial persistida**, não apenas como fallback. O contrato comum fica em `shared/avatarappearance/starter.json`: seis peças iniciais, três slots opcionais vazios, pele `#efd79d` e cabelo `#4b260f`. `playerstate.NewRecord` grava a combinação validada; `restoreAppearance` a usa quando não há aparência. A migração `202610200003_initial_appearance.go` preenche somente registros sem visual configurado. Aparências já personalizadas são preservadas, e cada peça continua podendo ser trocada e salva separadamente.

O personagem tem pele dourada clara, cabelo castanho com pico poligonal, olhos pretos, sobrancelhas castanhas, sorriso aberto, uniforme azul-claro com seis botões dourados e calça castanha. A referência anexada mostra apenas parte do corpo: calça, sapatos, costas e laterais são interpretações para completar as vistas. A reprodução visual é aproximada e pode receber ajustes de proporção e cor.

## Fontes editáveis

- `game/public/assets/avatar/starter/body.png`: albedo UV do rosto e da roupa, gerado com Image Gen sobre o gabarito do modelo.
- `game/public/assets/avatar/starter/hair.png`: textura castanha gerada com Image Gen.
- `game/dev/starter-avatar.js`: prévia interativa das peças, composição e bake do mesmo look usado pelo guarda-roupa.
- `game/src/avatar/starter-hair.ts`: variante `hairStarter`, com geometria independente, pico poligonal e textura que aceita a cor escolhida no editor.
- `game/src/avatar/starter-look.ts`: combinação das seis peças para gerar o fallback.
- `tools/avatar-fallback/uv-template.png`: gabarito usado na geração.
- `tools/avatar-fallback/reference.jpg`: imagem fornecida pelo responsável.
- `tools/avatar-fallback/prompts.json`: instruções enviadas ao gerador integrado.
- `tools/avatar-fallback/preview.png`: frame 20 (2 segundos), direções 0 a 7; posição/tile de referência (0, 0), sem simulação de caminhada.

O ajuste do cabelo preserva os pesos e a ligação ao esqueleto original. O atlas possui 90 células de 256 px, incluindo parado, caminhada, sentado, refeição, transporte e cozimento. As vistas simétricas usam o espelhamento já existente; transporte mantém oito direções. Apoio e escala são os mesmos do fallback anterior. A silhueta antiga foi preservada em seus arquivos originais.

## Peças disponíveis no guarda-roupa

As opções aparecem no início de suas categorias e usam os slots normais da aparência salva:

| Categoria | Nome | ID |
| --- | --- | --- |
| Cabelo | Cabelo pontudo Café Mania | 1040016 |
| Olhos | Olhos Café Mania | 1050022 |
| Boca | Sorriso Café Mania | 1060025 |
| Sobrancelhas | Sobrancelhas Café Mania | 1070012 |
| Camisa | Uniforme azul Café Mania | 1020056 |
| Calça | Calça castanha Café Mania | 1000021 |

Cada escolha pode ser combinada com peças antigas. Os símbolos faciais têm transparência e a roupa deixa o pescoço livre, para respeitar a cor da pele. A textura do cabelo usa um mapa de luminosidade derivado da imagem gerada, multiplicado pela cor escolhida. O corte clássico `hair05` não é alterado: a variante copia sua geometria e compartilha apenas o esqueleto.

Os recortes editáveis estão em `starter/eyes.png`, `mouth.png`, `eyebrows.png`, `shirt.png` e `pants.png`. `modular-source.png` foi produzido com Image Gen removendo a pele do UV original e preservando as demais partes. `hair-shading.png` é o mapa de luminosidade.

`starter/hair-icon.png` foi substituído por uma ilustração sem feições, gerada com Image Gen a partir de `Hair03` e da silhueta do corte novo. Usa cabeça cor de pêssego, cabelo castanho e contorno no padrão dos demais ícones, sem olhos, boca ou roupa. Fonte: `tools/avatar-fallback/hair-icon-source.png`; referência: `hair-icon-style-reference.png`; prompts: `hair-icon-prompt.txt`. `python tools/avatar-fallback/pack-hair-icon.py` recorta a transparência, reduz para 128×128 e substitui somente `StarterHairIcon` no atlas, sem mudar UVs ou IDs. O bake da prévia reutiliza esse ícone; não volta a gerar um recorte 3D do rosto.

`python tools/avatar-fallback/pack-modular.py` (Pillow) empacota os recortes no atlas, registra as peças em `wardrobe.json` e sincroniza a lista de IDs aceitos em `database/appearance/catalog.json`. O empacotamento é idempotente e preserva os símbolos anteriores. Depois de mudar os IDs do catálogo, o serviço do banco precisa ser recompilado; o launcher de desenvolvimento observa esse arquivo. As peças preservam os padrões do catálogo e as aparências já salvas. A escolha inicial do jogador é uma política separada, compartilhada com o servidor.

## Regenerar

Inicie apenas o cliente em uma porta livre, por exemplo `npm run dev --workspace game -- --host 127.0.0.1 --port 5187 --strictPort`, e abra `/dev/starter-avatar.html`. A página permite trocar cada peça e as cores, apresenta oito vistas e oferece exportação PNG/JSON. Salve os dois arquivos exportados em `game/public/assets/avatar/placeholder/`. A exportação usa a combinação inicial, independente das alterações feitas nos controles da prévia. Não é necessário iniciar banco ou servidor do jogo.

Confira as ações, o apoio, o pico do cabelo e as bordas antes de substituir o atlas. Rode `node --test tools/avatar-fallback/starter-avatar.test.mjs` para validar dimensões, apoio, escala, cobertura dos clipes e referências das mãos.
O mesmo teste também verifica os seis slots, ícones, registro no servidor e serialização das combinações. `go test ./database/appearance` testa a aceitação da combinação completa e a rejeição de slots duplicados. `tools/avatar-fallback/modular-preview.png` registra trocas individuais no frame 20, direção 0, tile de referência (0, 0), além de uma combinação com pele e cabelo recoloridos. São verificações isoladas, sem uma sessão multiplayer completa.

Como referência arquitetural, o [AvatarImage do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/master/src/nitro/avatar/AvatarImage.ts) mantém caches vinculados à ação, direção e frame e conserva pontos de registro na composição. Aqui esse princípio é aplicado ao atlas já usado pelo runtime, com chave clipe/direção/frame e apoio dos pés, sem copiar os algoritmos do Nitro.
O [AvatarVisualization](https://github.com/billsonnn/nitro-renderer/blob/master/src/nitro/room/object/visualization/avatar/AvatarVisualization.ts) também conserva a separação entre aparência, postura e offsets do sprite. Neste runtime, o cabelo novo entra na composição do look enquanto enquadramento, apoio e animações continuam compartilhados com as demais peças.

