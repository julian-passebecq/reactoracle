# Oracle Ops Agent

The agent is intentionally not implemented yet. This directory fixes its security and deployment boundary before code is added.

## Responsibilities

- send outbound heartbeats to the Control API
- read host inventory and health
- read K3s workload state through a least-privilege service account
- execute only allow-listed commands received from the Control API
- return command results and audit metadata

## Non-responsibilities

- no arbitrary shell execution endpoint
- no public web administration port
- no browser-facing SSH proxy
- no storage of OCI/OpenTofu CI credentials

## Runtime

Target implementation: a small ARM64-friendly Go binary managed by systemd on the Oracle VM.
