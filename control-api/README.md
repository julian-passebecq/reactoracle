# ReactOracle Control API

This FastAPI service is the external control-plane backend for the React UI.

## Local development

The repository is designed for an uv-backed FastAPI workflow. If the FastAPI project generator is available locally, use it for future standalone services. This initial in-repo service is kept minimal to preserve the monorepo structure.

```bash
cd control-api
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
fastapi dev app/main.py
```

Set an agent token before accepting VM telemetry:

```bash
export REACTORACLE_AGENT_TOKEN='replace-me'
```

Optional CORS origins:

```bash
export REACTORACLE_ALLOWED_ORIGINS='http://localhost:5173,https://ops.example.com'
```

The read endpoints intentionally match the TypeScript contracts in `src/domain/types.ts`.

## Security

The agent ingress requires a bearer token. The browser-facing read API should additionally be protected at the hosting/access layer before production exposure. No generic shell endpoint exists.
