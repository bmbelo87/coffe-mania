#!/usr/bin/env bash
# Atualiza o Café Mania sem derrubar quem está jogando (detalhes em docs/producao.md).
# Uso, como root no servidor: bash deploy/update.sh /opt/coffe/releases/cafe-mania-<versão>-linux-amd64
set -euo pipefail

release=$(realpath "${1:?informe a pasta da versão descompactada}")
public=/opt/coffe/public
test -f "$release/bin/coffe-database" && test -f "$release/bin/coffe-game-server" && test -f "$release/public/index.html"
# Um pacote gerado no Windows não guarda a permissão de execução.
chmod 755 "$release/bin/coffe-database" "$release/bin/coffe-game-server"

wait_for() {
	for _ in $(seq 1 80); do
		curl -fsS -o /dev/null "$1" && return 0
		sleep 0.25
	done
	echo "Serviço não respondeu: $1" >&2
	return 1
}

# 1. Arquivos novos primeiro, sem apagar os antigos: páginas abertas ainda carregam os
#    trechos da versão anterior pelo nome com hash. index.html fica para o fim.
rsync -a --exclude index.html "$release/public/" "$public/"
chown -R coffe:coffe "$public"

# 2. Binários: troca atômica do link da versão atual.
ln -sfn "$release" /opt/coffe/current

# 3. PocketBase reinicia em ~1 s, aplicando migrações; o Caddy segura as requisições.
systemctl restart coffe-database
wait_for http://127.0.0.1:8090/api/health

# 4. O servidor do jogo salva os quartos ao parar. Os clientes reconectam sozinhos e, se a
#    versão mudou, pedem para recarregar a página.
systemctl restart coffe-game
wait_for http://127.0.0.1:8091/game/health

# 5. Só agora a página nova passa a ser servida.
install -o coffe -g coffe -m 644 "$release/public/index.html" "$public/index.html"
echo "Café Mania $(cat "$release/VERSION") no ar."
