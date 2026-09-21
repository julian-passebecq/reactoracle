# Roadmap

## V0.1 - UI foundation — implemented

- React + TypeScript + Vite
- Fluent UI 2 shell
- route-level code splitting
- Oracle host overview
- platform health
- K3s workload inventory
- capacity view
- typed mock data contract
- architecture/security documentation

## V0.2 - read-only live control plane — implemented

- FastAPI Control API
- outbound Go/ARM64 agent heartbeat
- Oracle host inventory through OCI IMDSv2
- CPU/RAM/swap/load/disk/network telemetry
- K3s namespace/workload discovery
- metrics-server CPU/RAM aggregation
- bounded Kubernetes logs read path
- Grafana deep links
- service health
- ARM64 install bundle

## V0.3 - safe operations — partial

Implemented:

- VM health check
- guarded Kubernetes workload restart
- explicit mutation capability flag
- separate narrow restart RBAC overlay
- command polling/status
- audit/activity read model
- Docker image/cache inspection

Planned:

- Spark job submit
- dbt build/test job
- Polars job templates
- maintenance operations with explicit risk classes

## V0.4 - infrastructure as code — partial

Implemented:

- OpenTofu discovery/repository skeleton
- architecture for CI-based execution

Planned:

- CI validate/plan
- immutable approved plan artifact
- visual plan summary
- explicit approval for apply
- drift detection
- OCI resource inventory

## V0.5 - durable data architecture — contract implemented

- Oracle/K3s defined as compute rather than canonical business-data storage
- MotherDuck / DuckLake defined as planned durable Raw/Bronze/Silver/Gold/Features layer
- Gold serving contract and table catalog
- core DE flow separated from optional ML enrichment
- Contoso Forge Lite modeled as an optional synthetic source
- Kaggle/MLJAR modeled as optional ML compute
- Neon limited to optional compact serving/metadata roles
- business-specific React dashboards explicitly out of scope
- machine-readable architecture and Gold catalog Control API endpoints

Execution against MotherDuck/DuckLake remains a later slice.

## V0.6 - provider inventory — foundation implemented

- provider inventory read contract
- Providers UI
- lifecycle state: live / external / planned / optional
- telemetry state: live / partial / not connected
- no quota percentage shown without a live adapter and verified current limit
- Oracle, GitHub, Cloudflare, FastAPI Cloud, MotherDuck, Kafka, Kaggle, Neon, Colab, Hugging Face and optional GitLab represented

Planned:

- provider-specific usage adapters
- verified free-tier/plan limits
- alerting only after authoritative usage/limit data exists

## V0.7 - canonical end-to-end journey — planned

1. run Contoso Forge Lite from a governed generation spec;
2. publish Parquet + truth/provenance to MotherDuck / DuckLake Raw;
3. trigger Airflow;
4. execute Spark Bronze/Silver/Gold/feature transformations on Oracle K3s;
5. publish validated durable outputs back to DuckLake;
6. expose Gold to SQL / BI consumers;
7. optionally launch Kaggle/MLJAR from Features;
8. return historical ML outputs to DuckLake;
9. optionally mirror compact latest-state / metrics to Neon.

## Engineering quality

Implemented:

- FastAPI tests
- Go vet/tests
- Go formatting gate
- ARM64 build in CI
- monitoring YAML/shell validation
- full npm high-severity vulnerability audit
- deterministic npm lockfile + `npm ci`
- current GitHub Actions v7 Node 24 runtimes
- React route-level lazy loading

## Later

- authenticated production Grafana access/embedding
- maintenance/update workflows
- backup operations
- live provider quota telemetry
- richer dependency/blast-radius graph
- multi-machine support
- durable Control API state for horizontal scaling
