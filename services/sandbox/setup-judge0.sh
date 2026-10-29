#!/usr/bin/env bash
# Instala o Judge0 CE (sandbox da correção de código, spec 005 / RNF06) numa VM Ubuntu 22.04 x86_64.
# Rode duas vezes: a primeira liga o cgroup v1 e reinicia a VM; a segunda instala e sobe o Judge0.
# Uso: sudo bash setup-judge0.sh
set -euo pipefail

JUDGE0_VERSION="v1.13.1"
DIR="/opt/judge0-${JUDGE0_VERSION}"

if [[ $EUID -ne 0 ]]; then echo "Rode com sudo."; exit 1; fi
if [[ "$(uname -m)" != "x86_64" ]]; then
  echo "As imagens do Judge0 são só x86_64 (AMD/Intel). Esta VM é $(uname -m): recrie com processador AMD/Intel."
  exit 1
fi

# 1) O Judge0 1.13 isola com cgroup v1; o Ubuntu 22.04 vem com v2.
if [[ -f /sys/fs/cgroup/cgroup.controllers ]]; then
  echo ">> Ligando cgroup v1 (a VM vai reiniciar; depois rode este script de novo)."
  sed -i 's/^GRUB_CMDLINE_LINUX="\(.*\)"/GRUB_CMDLINE_LINUX="\1 systemd.unified_cgroup_hierarchy=0"/' /etc/default/grub
  # A Oracle Cloud sobrescreve o GRUB_CMDLINE_LINUX neste arquivo extra.
  for f in /etc/default/grub.d/*.cfg; do
    if [[ -f "$f" ]] && grep -q GRUB_CMDLINE_LINUX "$f"; then
      sed -i 's/^GRUB_CMDLINE_LINUX="\(.*\)"/GRUB_CMDLINE_LINUX="\1 systemd.unified_cgroup_hierarchy=0"/' "$f"
    fi
  done
  update-grub
  reboot
  exit 0
fi

# 2) Swap: a VM grátis de 1 GB não segura Judge0 + Postgres + Redis sem ela.
if ! swapon --show | grep -q /swapfile; then
  echo ">> Criando 4 GB de swap."
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

# 3) Docker.
if ! command -v docker >/dev/null; then
  echo ">> Instalando Docker."
  apt-get update -y && apt-get install -y docker.io docker-compose unzip
  systemctl enable --now docker
fi

# 4) Judge0 com senhas e token gerados aqui.
if [[ ! -d "$DIR" ]]; then
  echo ">> Baixando Judge0 ${JUDGE0_VERSION}."
  cd /opt
  wget -q "https://github.com/judge0/judge0/releases/download/${JUDGE0_VERSION}/judge0-${JUDGE0_VERSION}.zip"
  unzip -q "judge0-${JUDGE0_VERSION}.zip" && rm "judge0-${JUDGE0_VERSION}.zip"
  TOKEN="$(openssl rand -hex 24)"
  sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$(openssl rand -hex 16)/" "$DIR/judge0.conf"
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" "$DIR/judge0.conf"
  sed -i "s/^AUTHN_TOKEN=.*/AUTHN_TOKEN=${TOKEN}/" "$DIR/judge0.conf"
fi

cd "$DIR"
docker-compose up -d db redis
sleep 10
docker-compose up -d

# 5) Firewall do próprio Ubuntu (as imagens da Oracle bloqueiam tudo além da 22).
if command -v netfilter-persistent >/dev/null && ! iptables -C INPUT -p tcp --dport 2358 -j ACCEPT 2>/dev/null; then
  iptables -I INPUT 6 -m state --state NEW -p tcp --dport 2358 -j ACCEPT
  netfilter-persistent save
fi

IP="$(curl -s https://ifconfig.me || echo IP-DA-VM)"
TOKEN="$(grep '^AUTHN_TOKEN=' judge0.conf | cut -d= -f2)"
echo
echo "Judge0 no ar. Coloque na Vercel (Production) e faça Redeploy:"
echo "  SANDBOX_URL=http://${IP}:2358"
echo "  SANDBOX_TOKEN=${TOKEN}"
