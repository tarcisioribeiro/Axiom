#!/usr/bin/env bash
# ==============================================================================
# setup-ci-env.sh — Prepara o ambiente local para rodar ./ci-check.sh
#
# - Cria .venv (se não existir) e instala as deps de apps/api/requirements-dev.txt
#   + pip-audit.
# - Baixa kubeconform e gitleaks (binários sem gerenciador de pacote formal)
#   direto do GitHub Releases para .venv/bin — ficam no PATH após
#   `source .venv/bin/activate`, que é como os outros comandos do projeto já
#   rodam o ci-check.sh.
#
# Uso: ./setup-ci-env.sh
# ==============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
VENV_BIN="$VENV_DIR/bin"

echo "==> venv Python ($VENV_DIR)"
if [ ! -d "$VENV_DIR" ]; then
	python3 -m venv "$VENV_DIR"
fi
"$VENV_BIN/pip" install --quiet --upgrade pip
"$VENV_BIN/pip" install --quiet -r "$SCRIPT_DIR/apps/api/requirements-dev.txt" pip-audit
echo "    OK"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch_raw="$(uname -m)"

# Baixa um binário de uma release do GitHub e extrai para $VENV_BIN.
# Uso: install_from_github <nome-do-binário> <owner/repo> <trecho-do-nome-do-asset>
install_from_github() {
	local bin_name="$1" repo="$2" asset_pattern="$3"

	if [ -x "$VENV_BIN/$bin_name" ] || command -v "$bin_name" >/dev/null 2>&1; then
		echo "==> $bin_name já disponível, pulando"
		return
	fi

	echo "==> Instalando $bin_name (última release de $repo)"
	local url
	url="$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" |
		grep -o "\"browser_download_url\": *\"[^\"]*${asset_pattern}[^\"]*\"" |
		head -1 | cut -d'"' -f4)"

	if [ -z "$url" ]; then
		echo "    ✗ Não achei um asset para $bin_name em $os/$arch_raw. Instale manualmente." >&2
		return
	fi

	local tmp
	tmp="$(mktemp -d)"
	curl -fsSL "$url" -o "$tmp/asset.tar.gz"
	tar -xzf "$tmp/asset.tar.gz" -C "$tmp"
	find "$tmp" -type f -name "$bin_name" -exec mv {} "$VENV_BIN/$bin_name" \;
	chmod +x "$VENV_BIN/$bin_name" 2>/dev/null
	rm -rf "$tmp"

	if [ -x "$VENV_BIN/$bin_name" ]; then
		echo "    OK -> $VENV_BIN/$bin_name"
	else
		echo "    ✗ Download ok mas não encontrei o binário '$bin_name' dentro do arquivo." >&2
	fi
}

case "$arch_raw" in
x86_64) kc_arch="amd64" gl_arch="x64" ;;
aarch64 | arm64) kc_arch="arm64" gl_arch="arm64" ;;
*)
	echo "Arquitetura '$arch_raw' não mapeada para download automático — instale kubeconform/gitleaks manualmente." >&2
	kc_arch="" gl_arch=""
	;;
esac

if [ -n "$kc_arch" ]; then
	install_from_github "kubeconform" "yannh/kubeconform" "kubeconform-${os}-${kc_arch}.tar.gz"
fi
if [ -n "$gl_arch" ]; then
	install_from_github "gitleaks" "gitleaks/gitleaks" "_${os}_${gl_arch}.tar.gz"
fi

echo ""
echo "Pronto. Rode: source .venv/bin/activate && ./ci-check.sh"
