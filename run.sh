#!/usr/bin/env bash
# Equivalente Linux/macOS do run.bat. Instala o que faltar (Node, pnpm, Python) e sobe a aplicacao.
set -e

cd "$(dirname "$0")"

erro() {
    echo
    echo "Falhou. Corrija o problema acima e rode ./run.sh de novo."
    exit 1
}
trap erro ERR

NODE_MAJOR_MIN=20
export PATH="$HOME/.local/bin:$PATH"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

tem() { command -v "$1" >/dev/null 2>&1; }

# Pacotes do sistema: apt (Debian/Ubuntu/Mint), dnf (Fedora) ou brew (macOS).
instalar_pacote() {
    if tem apt-get; then
        sudo apt-get update -qq && sudo apt-get install -y "$@"
    elif tem dnf; then
        sudo dnf install -y "$@"
    elif tem brew; then
        brew install "$@"
    else
        echo "Instale manualmente: $*"
        return 1
    fi
}

node_ok() {
    tem node && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge "$NODE_MAJOR_MIN" ]
}

# --- Node.js >= 20 ---
if ! node_ok; then
    echo "Instalando Node.js 22 LTS..."
    if tem apt-get; then
        tem curl || instalar_pacote curl ca-certificates
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif tem dnf; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
        sudo dnf install -y nodejs
    elif tem brew; then
        brew install node@22 && brew link --overwrite --force node@22
    else
        echo "Instale o Node.js $NODE_MAJOR_MIN ou superior: https://nodejs.org"
        false
    fi
    node_ok
fi
echo "Node $(node -v)"

# --- pnpm (via corepack, sem sudo) ---
if ! tem pnpm; then
    echo "Instalando pnpm..."
    mkdir -p "$HOME/.local/bin"
    if tem corepack; then
        corepack enable --install-directory "$HOME/.local/bin" pnpm
    else
        npm install -g --prefix "$HOME/.local" pnpm
    fi
fi
echo "pnpm $(pnpm -v)"

# --- Python 3 (o teste de codigo em Python roda com ele no sandbox local) ---
if ! tem python3; then
    echo "Instalando Python 3..."
    instalar_pacote python3
fi

if [ ! -f .env ]; then
    echo "Criando .env a partir de .env.example..."
    cp .env.example .env
fi

# Sempre roda: e rapido quando nada mudou e pega dependencias novas do pnpm-lock.yaml.
echo "Instalando dependencias do projeto..."
pnpm install

# Confere o .env antes de tudo: sem isso a aplicacao sobe e quebra no login/upload.
node scripts/check-env.mjs

pnpm prisma generate
# Aplica migracoes pendentes e o seed (idempotente: rodar de novo nao duplica nada).
pnpm prisma migrate deploy
pnpm db:seed
pnpm build
# Com SANDBOX_URL="local" no .env, o teste de codigo roda direto nesta maquina (sem isolamento).
# O build e de producao, entao a liberacao precisa ser explicita.
trap - ERR
SANDBOX_ALLOW_LOCAL=1 exec pnpm start
