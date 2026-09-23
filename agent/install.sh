#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this installer as root." >&2
  exit 1
fi

install -d -m 0750 /etc/reactoracle /var/lib/reactoracle
install -m 0755 reactoracle-agent /usr/local/bin/reactoracle-agent
install -m 0644 reactoracle-agent.service /etc/systemd/system/reactoracle-agent.service

if [[ ! -f /etc/reactoracle/agent.env ]]; then
  install -m 0600 agent.env.example /etc/reactoracle/agent.env
  echo "Created /etc/reactoracle/agent.env. Edit it before starting the service."
fi

systemctl daemon-reload
systemctl enable reactoracle-agent.service

echo "Installation complete."
echo "Edit /etc/reactoracle/agent.env, then run:"
echo "  systemctl start reactoracle-agent"
