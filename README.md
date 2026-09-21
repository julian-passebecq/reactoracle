# ReactOracle

ReactOracle is a lightweight control-plane UI for a small Oracle Cloud data-engineering lab.

The target architecture is intentionally split:

- **React + Fluent UI 2 frontend** hosted outside the VM.
- **Control API** hosted outside the VM.
- **Tiny outbound-connected agent** on the Oracle VM.
- **K3s** on the VM for Airflow, Spark and observability workloads.
- **Grafana + Prometheus + Loki** for deep observability.
- **OpenTofu** for OCI infrastructure-as-code, executed through CI rather than as a resident VM service.

Development work is being bootstrapped on a feature branch before merge to `main`.
