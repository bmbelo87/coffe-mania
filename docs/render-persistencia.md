# Persistência do banco no Render (plano Free)

No Render Free, o disco do container é efêmero: ao dormir/acordar ou ao reimplantar, o banco local
(`/app/pb_data`) é perdido. Para evitar isso, o Litestream copia o SQLite continuamente para um
bucket S3-compatível e restaura esse backup quando o container sobe do zero.

Arquivos envolvidos:
- `deploy/litestream.render.yml` — configuração (sem segredos; lê tudo das variáveis).
- `entrypoint.sh` — restaura o banco antes de subir o PocketBase e inicia a replicação.
- `Dockerfile` — instala o binário do Litestream (versão em `LITESTREAM_VERSION`).

## Passo a passo (Cloudflare R2)

1. Crie uma conta em https://dash.cloudflare.com (pode pedir cadastro de pagamento para ativar o R2; o uso do backup fica no limite gratuito).
2. Em **R2 Object Storage** → **Create bucket** → nome: `cafe-mania-backup`.
3. Em **R2** → **Manage API tokens** → **Create API token** → permissão **Object Read & Write**, restrito ao bucket `cafe-mania-backup`.
4. Copie o **Access Key ID**, o **Secret Access Key** e o endpoint `https://<ID-DA-CONTA>.r2.cloudflarestorage.com`.
5. No painel do Render, serviço `coffe-mania` → **Environment**, adicione:

   | Variável | Valor |
   | --- | --- |
   | `LITESTREAM_BUCKET` | `cafe-mania-backup` |
   | `LITESTREAM_ENDPOINT` | `https://<ID-DA-CONTA>.r2.cloudflarestorage.com` |
   | `LITESTREAM_ACCESS_KEY_ID` | Access Key ID do passo 4 |
   | `LITESTREAM_SECRET_ACCESS_KEY` | Secret Access Key do passo 4 |

6. Faça o deploy. Nos logs deve aparecer "Restaurando banco do bucket" e "Iniciando replicação".

## Comportamento

- Se o bucket estiver vazio (primeira vez), o servidor começa com banco novo.
- Se a restauração falhar por erro de rede ou de credencial, o container **não sobe**. Isso é de propósito: subir com banco vazio sobrescreveria o backup bom na próxima cópia.
- Sem `LITESTREAM_BUCKET`/`LITESTREAM_ENDPOINT`, o servidor sobe como antes, sem backup, e o log avisa.

## Testar

Depois de jogar algo, espere alguns minutos e confira no bucket se há arquivos `data.db/` e `auxiliary.db/`.
Para testar a restauração, reimplante o serviço e confirme que o personagem continua.
