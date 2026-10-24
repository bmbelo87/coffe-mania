# Produção: alpha fechado

Guia para colocar o Café Mania num servidor público e operá-lo: instalação, atualização sem queda, manutenção, papéis e suspensões, backups. Os arquivos citados estão em `deploy/`.

## Arquitetura

```
jogador ──HTTPS/WSS──> Cloudflare (DDoS, cache dos assets) ──> Caddy :443 (esta máquina)
                                                                 ├─ /game/*  → servidor do jogo 127.0.0.1:8091
                                                                 └─ resto    → PocketBase     127.0.0.1:8090
```

- Só o Caddy escuta na internet, e o firewall só aceita conexões vindas da Cloudflare (e SSH do administrador).
- O PocketBase e o servidor do jogo escutam em 127.0.0.1. O painel `/_/` e as APIs genéricas do PocketBase (`/api/collections`, `/api/settings`, `/api/backups`…) respondem 404 pelo Caddy; a administração usa um túnel SSH.
- O IP real do jogador vem do `CF-Connecting-IP`, aceito só de endereços da Cloudflare. O Caddy o repassa ao PocketBase em `X-Real-IP` (`COFFE_TRUSTED_PROXY_HEADER`), usado pelos limites de requisições e pelos registros.
- Uma máquina basta para dezenas a centenas de jogadores (SQLite em WAL, um processo por serviço). O teste de carga da fase A4 confirma o tamanho; o ponto de partida é uma VPS com 4 vCPU e 8 GB em São Paulo, pela latência.

## Instalação inicial

1. **Máquina** (Debian/Ubuntu): crie o usuário `coffe` e as pastas.
   ```sh
   useradd --system --home /var/lib/coffe --shell /usr/sbin/nologin coffe
   mkdir -p /opt/coffe/releases /opt/coffe/public /var/lib/coffe /etc/coffe
   chown coffe:coffe /var/lib/coffe /opt/coffe/public
   ```
2. **Pacote**: na máquina de desenvolvimento, `npm run release` gera `.runtime/release/cafe-mania-<versão>-linux-amd64.tar.gz` (cliente compilado, os dois binários sem dependências e `deploy/`). Copie e descompacte em `/opt/coffe/releases/`.
3. **Configuração**: copie `deploy/production.env.example` para `/etc/coffe/production.env` (`chmod 640`, grupo `coffe`). O PocketBase recusa iniciar com `COFFE_DEV_TOOLS` ou `COFFE_DEV_SEED` ligados, sem `COFFE_SECURE_COOKIES=true` ou sem o cabeçalho do IP real.
4. **Serviços**: copie `deploy/systemd/*.service` para `/etc/systemd/system/` e rode `bash deploy/update.sh` com a pasta da versão (a primeira execução publica os arquivos e inicia os dois serviços). Depois, `systemctl enable coffe-database coffe-game`.
5. **Superusuário** do PocketBase (dashboard):
   ```sh
   sudo -u coffe /opt/coffe/current/bin/coffe-database superuser create EMAIL SENHA --dir=/var/lib/coffe/pb_data
   ```
6. **Cloudflare**: domínio com proxy ligado (nuvem laranja), SSL/TLS em *Full (strict)* e um *Origin Certificate* salvo em `/etc/caddy/cloudflare-origin.pem` e `-key.pem`. WebSockets já vêm ligados; o batimento do jogo (20 s) fica abaixo do limite de inatividade da Cloudflare (100 s).
7. **Caddy**: instale, ajuste o domínio em `deploy/Caddyfile`, copie para `/etc/caddy/Caddyfile` e recarregue. Confira a lista de IPs da Cloudflare em https://www.cloudflare.com/ips/.
8. **Firewall**: porta 443 só para os IPs da Cloudflare; porta 22 só para o seu IP; o resto fechado.
9. **Backups**: veja abaixo.

## Atualizar sem derrubar ninguém

```sh
bash deploy/update.sh /opt/coffe/releases/cafe-mania-<versão>-linux-amd64
```

O script segue esta ordem:

1. Publica os arquivos novos do cliente sem apagar os antigos: quem está jogando ainda carrega trechos da versão anterior pelo nome com hash.
2. Troca o link `/opt/coffe/current` para a nova versão.
3. Reinicia o PocketBase (~1 s, aplicando migrações). O Caddy segura as requisições enquanto isso (`lb_try_duration`).
4. Reinicia o servidor do jogo, que salva todos os quartos ao parar. Os clientes reconectam sozinhos com "Reconectando…" por alguns segundos.
5. Publica o `index.html` novo.

Se a versão mudou, o servidor do jogo recusa a página antiga (código 4003) e o jogador vê "Nova versão disponível" com o botão **Atualizar**.

- **Arquivos antigos**: `/opt/coffe/public` acumula arquivos de versões anteriores. Apague os que tiverem mais de uma semana, de vez em quando.
- **Migração que muda dados do jogo**: faça numa janela de manutenção avisada, como na seção abaixo.

## Manutenção e encerramento

O modo de operação fica no registro único da coleção `game_status`:

| Modo | Efeito |
| --- | --- |
| `open` | Jogo aberto. |
| `maintenance` | A partir de `starts_at` (vazio = agora), só a equipe entra. Antes disso, quem está jogando vê a faixa "Manutenção em mm:ss" com a mensagem. `ends_at` é só a previsão mostrada na tela de entrada. |
| `closed` | Alpha encerrado: a tela de entrada mostra a mensagem de despedida; os dados ficam guardados. |

Quando a manutenção começa:

- os jogadores conectados saem para a tela de entrada;
- as rotas do jogo respondem 503 para quem não é da equipe;
- `/play` volta para `/`.

Login, sessão e status continuam funcionando, para a equipe entrar e reabrir o jogo.

**Como mudar o modo:**

- **Pelo dashboard:** pelo túnel SSH, edite o registro de `game_status`.
- **Pela rota de admin:** com uma conta `admin` logada no jogo, `POST /api/coffe/admin/status`, com o corpo `{"mode","message","startsAt","endsAt"}` (instantes em ms; `startsAt` até 7 dias à frente). O painel da fase A2 vai usar essa rota.

A mudança vale na hora, pelos dois caminhos: o PocketBase avisa o servidor do jogo, que também relê o modo a cada minuto.

## Lista de espera e convites

Quem não tem conta vê a página inicial, com a história do projeto, a lista de espera e a entrada. Contas só nascem por convite.

1. **Lista de espera:**
   - A pessoa entra com nome, email, 18+ e o aceite da Privacidade, e confirma pelo link do email (vale 3 dias).
   - A resposta é sempre igual, exista o email ou não.
   - Há limite por IP, campo-armadilha para robôs e Turnstile.
2. **Ondas:** com uma conta `admin` logada, `POST /api/coffe/admin/invites/waitlist` com `{"count": 15, "wave": 1}` convida os primeiros confirmados da fila, por ordem de confirmação.
   - O convite vale 14 dias (`days` muda isso, até 60).
   - Plano combinado: ondas de 15 → 50 → 200, cada uma só se a anterior tiver boa retenção e poucos erros.
3. **Convite direto** (amigos do projeto): `POST /api/coffe/admin/invites` com `{"email", "wave", "send": true}`.
   - A resposta traz o link, que pode ser enviado à mão.
   - Um convite novo para o mesmo email anula o anterior.
4. **Cadastro** (`/convite#código`):
   - nome no jogo filtrado;
   - senha de 8+ caracteres, recusando as comuns;
   - 18+ e aceite dos Termos, da Privacidade e da Conduta, com a versão registrada.
   - A conta nasce verificada, e o convite não serve de novo.
5. **Esqueci a senha** (`/senha`): o link vale uma vez e, ao trocar a senha, todas as sessões caem.
6. **Minha conta** (`/conta`): trocar a senha, baixar os dados (LGPD), sair de todos os aparelhos e excluir a conta, que apaga o café e o progresso em cascata.

Os segredos dos links ficam depois do `#` e não chegam aos registros do servidor. No modo dev, sem SMTP, os emails não saem: ficam em `/api/coffe/dev/mailbox`, só para a equipe.

Os textos legais estão em `game/src/auth/legal.ts`, e a versão deles precisa ser igual a `LegalVersion` em `database/access.go` (um teste confere). Revise com alguém da área jurídica antes de abrir.

## Papéis e suspensões

Ainda sem o painel de admin (fase A2), tudo isto se faz pelo dashboard (coleção `users`):

- **Papel** (`role`):
  - vazio ou `player`: jogador;
  - `tester`: entra na manutenção e usa as ferramentas de desenvolvimento quando o servidor as habilita (nunca em produção);
  - `admin`: o mesmo que `tester`, mais a rota de modo de operação.
- **Suspensão**: preencha `suspended_until` e, se quiser, `suspension_reason`. Para banir sem prazo, use o ano 9999. Ao salvar, todas as sessões da conta deixam de valer na hora (a chave dos tokens é trocada) e as conexões abertas caem. Ao tentar entrar, a pessoa vê o prazo e o motivo. Quando o prazo passa, a conta volta a entrar sozinha.
- **"Sair de todos os aparelhos"**: na tela de entrada, encerra as sessões da própria conta em todos os aparelhos.
- **Uma janela por conta**: abrir o jogo em outra janela ou aparelho fecha a anterior, com o aviso "Café aberto em outra janela".

## Backups

- **PocketBase**: backup diário (`COFFE_BACKUP_CRON`), guardando os 7 últimos (`COFFE_BACKUP_KEEP`) em `pb_data/backups`. Ele protege contra erros de operação, não contra a perda da máquina.
- **Litestream** (`deploy/litestream.yml`): copia `data.db` continuamente para um armazenamento S3 (R2 ou B2), com uma semana de histórico.
- **Restauro** (teste antes do lançamento, e depois a cada mês):
  ```sh
  systemctl stop coffe-game coffe-database
  litestream restore -o /var/lib/coffe/pb_data/data.db s3://cafe-mania-backup/data.db
  chown coffe:coffe /var/lib/coffe/pb_data/data.db
  systemctl start coffe-database coffe-game
  ```

## Administração pelo túnel SSH

```sh
ssh -L 8090:127.0.0.1:8090 usuario@servidor
```

Com o túnel aberto, o dashboard fica em http://127.0.0.1:8090/_/. Nunca abra a porta 8090 na internet.

## Antes de abrir para jogadores

- [ ] `npm run release` gera o pacote e `deploy/update.sh` instala numa máquina limpa.
- [ ] O PocketBase recusa iniciar com uma configuração de produção errada (teste uma vez).
- [ ] `https://dominio/_/` e `https://dominio/api/collections/users/records` respondem 404.
- [ ] Uma conta `player` não recebe ferramentas de desenvolvimento.
- [ ] Email real: lista de espera, convite e nova senha chegam (confira o spam), e os links abrem o domínio certo.
- [ ] Turnstile aparece na lista de espera e em "Esqueci minha senha".
- [ ] `COFFE_CONTACT_EMAIL` aparece nos Termos e na Privacidade, revisados juridicamente.
- [ ] Manutenção programada: a faixa aparece, o jogador sai na hora marcada e a equipe continua.
- [ ] Suspensão derruba a sessão aberta e mostra o motivo no login.
- [ ] Atualização com jogadores conectados: reconectam, e veem "Nova versão" quando a versão muda.
- [ ] O restauro do Litestream funciona.
