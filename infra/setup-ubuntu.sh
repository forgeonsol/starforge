#!/usr/bin/env bash
# One-time hardening of a fresh Ubuntu 22.04 / 24.04 VPS for $FORGE. Run as root:
#   sudo bash infra/setup-ubuntu.sh                 # firewall, fail2ban, auto security updates, Docker
#   sudo bash infra/setup-ubuntu.sh --deploy-user forge --harden-ssh
#       also creates a sudo user "forge" with your root SSH keys, then turns off root and password SSH logins.
#       Only use --harden-ssh after you have logged in with an SSH key, or you can lock yourself out.
set -euo pipefail

DEPLOY_USER=""; HARDEN_SSH=0
while [ $# -gt 0 ]; do
  case "$1" in
    --deploy-user) DEPLOY_USER="$2"; shift 2 ;;
    --harden-ssh) HARDEN_SSH=1; shift ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)"; exit 1; }
. /etc/os-release
[ "$ID" = "ubuntu" ] || { echo "this script is for Ubuntu; you have $ID"; exit 1; }

echo "==> system updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades

echo "==> automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

echo "==> firewall: only SSH, HTTP and HTTPS"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> fail2ban for SSH"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "==> Docker (official repository)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# container logs are capped; Docker never writes around ufw for ports we do not publish
mkdir -p /etc/docker
[ -f /etc/docker/daemon.json ] || cat > /etc/docker/daemon.json <<'EOF'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" }, "live-restore": true }
EOF
systemctl enable --now docker
systemctl restart docker

if [ -n "$DEPLOY_USER" ]; then
  echo "==> deploy user $DEPLOY_USER"
  id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo,docker "$DEPLOY_USER"
  if [ -f /root/.ssh/authorized_keys ]; then
    install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
    install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
  fi
  echo "    set a sudo password for $DEPLOY_USER with: passwd $DEPLOY_USER"
fi

if [ "$HARDEN_SSH" -eq 1 ]; then
  KEYS="/root/.ssh/authorized_keys"; [ -n "$DEPLOY_USER" ] && KEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
  if [ ! -s "$KEYS" ]; then
    echo "!! no SSH key in $KEYS; leaving password login on so you are not locked out"
  else
    echo "==> SSH: keys only, no root login"
    cat > /etc/ssh/sshd_config.d/10-forge.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
MaxAuthTries 4
EOF
    sshd -t && (systemctl restart ssh 2>/dev/null || systemctl restart sshd)
    echo "    open a NEW terminal and check you can still log in before closing this one"
  fi
fi

echo
echo "Done. Next: clone the repo, fill in infra/.env, then: cd infra && docker compose up -d --build"
