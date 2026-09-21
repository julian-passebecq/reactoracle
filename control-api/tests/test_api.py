from datetime import datetime, timezone

from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from app.main import app
from app.models import DurableDataZone, GoldTableContract, PlatformArchitecture, PlatformNode, ProviderInventory, ProviderInventoryItem
from app.state import store


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_control_plane_store():
    store.reset()
    yield
    store.reset()


def test_health() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_live_read_endpoints_require_agent_snapshot() -> None:
    for path in (
        "/api/v1/overview",
        "/api/v1/k8s/workloads",
        "/api/v1/infrastructure",
        "/api/v1/maintenance",
    ):
        response = client.get(path)
        assert response.status_code == 503
        assert response.json()["detail"] == "No live Oracle agent snapshot has been received yet."


def test_agent_ingress_requires_configured_token(monkeypatch) -> None:
    monkeypatch.delenv("REACTORACLE_AGENT_TOKEN", raising=False)
    response = client.post(
        "/api/v1/agent/heartbeat",
        json={
            "agentVersion": "0.1.0",
            "machineId": "oracle-a1-01",
            "status": "healthy",
            "k3sReachable": True,
            "sentAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert response.status_code == 503


def test_agent_ingress_rejects_wrong_token(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    response = client.post(
        "/api/v1/agent/heartbeat",
        headers={"Authorization": "Bearer wrong-token"},
        json={
            "agentVersion": "0.1.0",
            "machineId": "oracle-a1-01",
            "status": "healthy",
            "k3sReachable": True,
            "sentAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert response.status_code == 401


def test_agent_heartbeat_with_token(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    response = client.post(
        "/api/v1/agent/heartbeat",
        headers={"Authorization": "Bearer test-token"},
        json={
            "agentVersion": "0.1.0",
            "machineId": "oracle-a1-01",
            "status": "healthy",
            "k3sReachable": True,
            "sentAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert response.status_code == 204
    status_response = client.get("/api/v1/agent/status")
    assert status_response.status_code == 200
    assert status_response.json()["connected"] is True


def test_agent_snapshot_updates_read_model(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    now = datetime.now(timezone.utc).isoformat()
    snapshot = {
        "machineId": "oracle-live",
        "collectedAt": now,
        "host": {
            "id": "oracle-live",
            "name": "oracle-live",
            "shape": "VM.Standard.A1.Flex",
            "ocpu": 2,
            "memoryGb": 12,
            "cpuPercent": 41.2,
            "memoryUsedGb": 6.4,
            "diskPercent": 35.1,
            "uptime": "4d 02h",
            "k3sVersion": "k3s version v1.34.0",
            "swapUsedGb": 0.2,
            "load1": 0.7,
            "diskUsedGb": 35.1,
            "diskTotalGb": 100,
            "networkRxMbps": 2.4,
            "networkTxMbps": 0.9,
        },
        "workloads": [
            {
                "id": "monitoring/grafana",
                "name": "grafana",
                "namespace": "monitoring",
                "kind": "Deployment",
                "status": "Running",
                "cpuMillicores": 0,
                "memoryMb": 0,
                "restarts": 0,
            }
        ],
        "namespaces": [
            {
                "name": "monitoring",
                "podsReady": 1,
                "podsTotal": 1,
                "cpuMillicores": 0,
                "memoryMb": 0,
            }
        ],
        "maintenance": {
            "os": "Ubuntu 24.04.3 LTS",
            "kernel": "6.8.0",
            "updatesAvailable": 0,
            "securityUpdates": 0,
            "rebootRequired": False,
            "unusedImagesGb": 0,
            "prometheusGb": 0,
            "lokiGb": 0,
            "lastBackup": "unknown",
            "backupStatus": "unknown",
        },
    }
    response = client.post(
        "/api/v1/agent/snapshot",
        headers={"Authorization": "Bearer test-token"},
        json=snapshot,
    )
    assert response.status_code == 204

    overview = client.get("/api/v1/overview").json()
    assert overview["vm"]["id"] == "oracle-live"
    assert overview["vm"]["cpuPercent"] == 41.2
    assert overview["vm"]["networkRxMbps"] == 2.4
    assert overview["vm"]["diskTotalGb"] == 100
    assert overview["vm"]["projectedCost"] == "Not connected"
    assert overview["infrastructure"]["state"] == "unknown"
    assert overview["infrastructure"]["managedResources"] == 0
    assert overview["workloads"][0]["name"] == "grafana"


def test_safe_health_check_command_round_trip(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")

    created = client.post(
        "/api/v1/commands",
        json={"command": "vm.health_check", "machineId": "oracle-command-test"},
    )
    assert created.status_code == 202
    command = created.json()
    assert command["status"] == "queued"
    assert command["risk"] == "safe"

    leased = client.get(
        "/api/v1/agent/commands/next",
        params={"machineId": "oracle-command-test"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert leased.status_code == 200
    assert leased.json()["id"] == command["id"]
    assert leased.json()["command"] == "vm.health_check"

    running = client.get(f"/api/v1/commands/{command['id']}")
    assert running.status_code == 200
    assert running.json()["status"] == "running"

    completed = client.post(
        f"/api/v1/agent/commands/{command['id']}/result",
        headers={"Authorization": "Bearer test-token"},
        json={
            "status": "success",
            "result": {
                "k3sReachable": True,
                "workloadCount": 7,
                "namespaceCount": 4,
            },
        },
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "success"
    assert completed.json()["result"]["k3sReachable"] is True


def test_agent_only_leases_commands_for_its_machine(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    created = client.post(
        "/api/v1/commands",
        json={"command": "vm.health_check", "machineId": "oracle-other"},
    )
    assert created.status_code == 202

    response = client.get(
        "/api/v1/agent/commands/next",
        params={"machineId": "oracle-different"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 204


def test_k8s_log_command_round_trip(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")

    created = client.post(
        "/api/v1/commands",
        json={
            "command": "k8s.logs",
            "machineId": "oracle-log-test",
            "arguments": {
                "namespace": "airflow",
                "name": "airflow-scheduler",
                "kind": "Deployment",
                "tail": 120,
            },
        },
    )
    assert created.status_code == 202
    command = created.json()
    assert command["status"] == "queued"
    assert command["command"] == "k8s.logs"
    assert command["arguments"]["tail"] == 120

    leased = client.get(
        "/api/v1/agent/commands/next",
        params={"machineId": "oracle-log-test"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert leased.status_code == 200
    assert leased.json()["arguments"]["namespace"] == "airflow"
    assert leased.json()["arguments"]["kind"] == "Deployment"

    completed = client.post(
        f"/api/v1/agent/commands/{command['id']}/result",
        headers={"Authorization": "Bearer test-token"},
        json={
            "status": "success",
            "result": {
                "namespace": "airflow",
                "workload": "airflow-scheduler",
                "kind": "Deployment",
                "lineCount": 2,
                "text": "line one\nline two\n",
            },
        },
    )
    assert completed.status_code == 200
    assert completed.json()["result"]["lineCount"] == 2


def test_k8s_log_command_rejects_unsafe_target() -> None:
    response = client.post(
        "/api/v1/commands",
        json={
            "command": "k8s.logs",
            "machineId": "oracle-log-test",
            "arguments": {
                "namespace": "airflow;rm -rf /",
                "name": "scheduler",
                "kind": "Deployment",
                "tail": 100,
            },
        },
    )
    assert response.status_code == 422


def test_k8s_log_command_caps_tail() -> None:
    response = client.post(
        "/api/v1/commands",
        json={
            "command": "k8s.logs",
            "machineId": "oracle-log-test",
            "arguments": {
                "namespace": "airflow",
                "name": "scheduler",
                "kind": "Deployment",
                "tail": 5000,
            },
        },
    )
    assert response.status_code == 422


def test_k8s_restart_command_round_trip(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    monkeypatch.setenv("REACTORACLE_ENABLE_MUTATIONS", "true")

    created = client.post(
        "/api/v1/commands",
        json={
            "command": "k8s.restart_workload",
            "machineId": "oracle-restart-test",
            "arguments": {
                "namespace": "airflow",
                "name": "airflow-scheduler",
                "kind": "Deployment",
            },
        },
    )
    assert created.status_code == 202
    command = created.json()
    assert command["status"] == "queued"
    assert command["risk"] == "moderate"
    assert command["arguments"] == {
        "namespace": "airflow",
        "name": "airflow-scheduler",
        "kind": "Deployment",
    }

    leased = client.get(
        "/api/v1/agent/commands/next",
        params={"machineId": "oracle-restart-test"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert leased.status_code == 200
    assert leased.json()["command"] == "k8s.restart_workload"


def test_k8s_restart_rejects_jobs_and_extra_arguments(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_ENABLE_MUTATIONS", "true")
    job_response = client.post(
        "/api/v1/commands",
        json={
            "command": "k8s.restart_workload",
            "machineId": "oracle-restart-test",
            "arguments": {
                "namespace": "spark",
                "name": "spark-job",
                "kind": "Job",
            },
        },
    )
    assert job_response.status_code == 422

    extra_response = client.post(
        "/api/v1/commands",
        json={
            "command": "k8s.restart_workload",
            "machineId": "oracle-restart-test",
            "arguments": {
                "namespace": "airflow",
                "name": "airflow-scheduler",
                "kind": "Deployment",
                "image": "malicious-change",
            },
        },
    )
    assert extra_response.status_code == 422


def test_restart_capability_disabled_by_default(monkeypatch) -> None:
    monkeypatch.delenv("REACTORACLE_ENABLE_MUTATIONS", raising=False)
    response = client.get("/api/v1/capabilities")
    assert response.status_code == 200
    assert response.json()["restartWorkload"] is False

    denied = client.post(
        "/api/v1/commands",
        json={
            "command": "k8s.restart_workload",
            "machineId": "oracle-restart-test",
            "arguments": {
                "namespace": "airflow",
                "name": "airflow-scheduler",
                "kind": "Deployment",
            },
        },
    )
    assert denied.status_code == 403


def test_restart_capability_enabled_explicitly(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_ENABLE_MUTATIONS", "true")
    response = client.get("/api/v1/capabilities")
    assert response.status_code == 200
    assert response.json()["restartWorkload"] is True


def test_platform_architecture_contract() -> None:
    response = client.get("/api/v1/platform/architecture")
    assert response.status_code == 200
    body = response.json()

    assert body["goldSurvivesVmShutdown"] is True
    assert body["businessReactInScope"] is False

    nodes = {node["id"]: node for node in body["nodes"]}
    assert nodes["motherduck"]["durable"] is True
    assert nodes["motherduck"]["layer"] == "lakehouse"
    assert nodes["spark"]["durable"] is False
    assert nodes["airflow"]["location"] == "Oracle K3s"

    known_ids = set(nodes)
    assert set(body["deliveryFlow"]).issubset(known_ids)
    assert set(body["controlFlow"]).issubset(known_ids)
    assert set(body["engineeringFlow"]).issubset(known_ids)
    assert set(body["mlEnrichmentFlow"]).issubset(known_ids)

    assert body["deliveryFlow"][0] == "github"
    assert body["controlFlow"][0] == "reactoracle"
    assert body["controlFlow"][-1] == "oracle-vm"

    gold_zone = next(zone for zone in body["durableZones"] if zone["name"] == "Gold")
    assert gold_zone["owner"] == "MotherDuck / DuckLake"

    # Core Gold serving must not depend on Kaggle or Neon.
    assert "kaggle" not in body["engineeringFlow"]
    assert "neon" not in body["engineeringFlow"]
    assert "bi" in body["engineeringFlow"]

    # ML is explicitly a side branch that returns analytical history to the lakehouse.
    assert body["mlEnrichmentFlow"][0] == "motherduck"
    assert "kaggle" in body["mlEnrichmentFlow"]
    assert body["mlEnrichmentFlow"].count("motherduck") == 2
    assert "neon" not in body["mlEnrichmentFlow"]


def test_gold_catalog_is_durable_and_namespaced() -> None:
    response = client.get("/api/v1/platform/gold-catalog")
    assert response.status_code == 200
    rows = response.json()

    names = [row["name"] for row in rows]
    assert len(names) == len(set(names))
    assert all(name.startswith("gold.") for name in names)
    assert all(row["storage"] == "MotherDuck / DuckLake" for row in rows)

    base_tables = [row for row in rows if not row["mlDerived"]]
    assert len(base_tables) >= 4
    assert all(row["status"] == "planned" for row in rows)

    score_table = next(row for row in rows if row["name"] == "gold.customer_scores")
    assert score_table["mlDerived"] is True


def test_provider_inventory_avoids_unverified_quota_claims() -> None:
    response = client.get("/api/v1/platform/providers")
    assert response.status_code == 200
    body = response.json()

    assert body["usageBarsRequireVerifiedLimits"] is True
    providers = body["providers"]
    ids = [provider["id"] for provider in providers]
    assert len(ids) == len(set(ids))

    assert all(provider["limitsVerified"] is False for provider in providers)
    assert all("quotaUsedPct" not in provider for provider in providers)

    oracle = next(provider for provider in providers if provider["id"] == "oracle")
    assert oracle["state"] == "live"
    assert oracle["telemetry"] == "partial"

    motherduck = next(provider for provider in providers if provider["id"] == "motherduck")
    assert motherduck["category"] == "lakehouse"
    assert motherduck["state"] == "planned"

    kaggle = next(provider for provider in providers if provider["id"] == "kaggle")
    assert kaggle["category"] == "ml"

    colab = next(provider for provider in providers if provider["id"] == "colab")
    assert colab["state"] == "optional"


def test_k8s_logs_rejects_extra_arguments() -> None:
    response = client.post(
        "/api/v1/commands",
        json={
            "command": "k8s.logs",
            "machineId": "oracle-log-test",
            "arguments": {
                "namespace": "airflow",
                "name": "airflow-scheduler",
                "kind": "Deployment",
                "tail": 100,
                "container": "unexpected",
            },
        },
    )
    assert response.status_code == 422


def test_platform_architecture_rejects_unknown_flow_nodes() -> None:
    with pytest.raises(ValidationError):
        PlatformArchitecture(
            nodes=[
                PlatformNode(
                    id="motherduck",
                    name="MotherDuck / DuckLake",
                    layer="lakehouse",
                    state="planned",
                    provider="MotherDuck",
                    role="Durable lakehouse",
                    durable=True,
                    location="Managed external",
                )
            ],
            deliveryFlow=[],
            controlFlow=[],
            engineeringFlow=["motherduck", "missing-node"],
            mlEnrichmentFlow=[],
            durableZones=[
                DurableDataZone(
                    name="Gold",
                    owner="MotherDuck / DuckLake",
                    purpose="Canonical Gold",
                )
            ],
        )


def test_platform_architecture_rejects_duplicate_node_ids() -> None:
    node = PlatformNode(
        id="duplicate",
        name="Duplicate",
        layer="source",
        state="planned",
        provider="test",
        role="test",
        durable=False,
        location="test",
    )
    with pytest.raises(ValidationError):
        PlatformArchitecture(
            nodes=[node, node],
            deliveryFlow=[],
            controlFlow=[],
            engineeringFlow=[],
            mlEnrichmentFlow=[],
            durableZones=[
                DurableDataZone(
                    name="Gold",
                    owner="MotherDuck / DuckLake",
                    purpose="Canonical Gold",
                )
            ],
        )


def test_platform_architecture_enforces_gold_durability_owner() -> None:
    with pytest.raises(ValidationError):
        PlatformArchitecture(
            nodes=[],
            deliveryFlow=[],
            controlFlow=[],
            engineeringFlow=[],
            mlEnrichmentFlow=[],
            durableZones=[
                DurableDataZone(
                    name="Gold",
                    owner="Oracle local disk",
                    purpose="Bad durability boundary",
                )
            ],
            goldSurvivesVmShutdown=True,
        )


def test_platform_architecture_rejects_business_react_scope() -> None:
    with pytest.raises(ValidationError):
        PlatformArchitecture(
            nodes=[],
            deliveryFlow=[],
            controlFlow=[],
            engineeringFlow=[],
            mlEnrichmentFlow=[],
            durableZones=[
                DurableDataZone(
                    name="Gold",
                    owner="MotherDuck / DuckLake",
                    purpose="Canonical Gold",
                )
            ],
            businessReactInScope=True,
        )


def test_gold_contract_validation_rejects_bad_names_and_duplicate_consumers() -> None:
    with pytest.raises(ValidationError):
        GoldTableContract(
            name="sales_daily",
            grain="day",
            purpose="bad namespace",
            consumers=["SQL"],
            storage="MotherDuck / DuckLake",
        )

    with pytest.raises(ValidationError):
        GoldTableContract(
            name="gold.sales_daily",
            grain="day",
            purpose="duplicate consumers",
            consumers=["SQL", "SQL"],
            storage="MotherDuck / DuckLake",
        )


def test_provider_inventory_rejects_duplicate_ids_and_unverified_quota_policy() -> None:
    provider = ProviderInventoryItem(
        id="same",
        name="Same",
        category="compute",
        state="external",
        role="test",
        costIntent="unknown",
        telemetry="not-connected",
        limitsVerified=False,
        detail="test",
    )
    with pytest.raises(ValidationError):
        ProviderInventory(providers=[provider, provider])

    with pytest.raises(ValidationError):
        ProviderInventory(
            providers=[provider],
            usageBarsRequireVerifiedLimits=False,
        )


def test_data_factory_plan_contract() -> None:
    response = client.get("/api/v1/platform/data-factory")
    assert response.status_code == 200
    body = response.json()

    assert body["executionEnabled"] is False
    assert body["businessReactInScope"] is False
    assert body["contoso"]["optional"] is True
    assert body["contoso"]["output"]["format"] == "Parquet"
    assert body["contoso"]["output"]["destination"] == "MotherDuck / DuckLake"
    assert "Gold" in body["contoso"]["output"]["durableZones"]

    core_ids = [stage["id"] for stage in body["coreStages"]]
    assert core_ids == ["generate", "lake-raw", "orchestrate", "process", "publish", "consume"]

    ml_ids = [stage["id"] for stage in body["mlStages"]]
    assert ml_ids == ["features", "train", "publish-ml", "serve-ml"]
    assert next(stage for stage in body["mlStages"] if stage["id"] == "train")["location"] == "Kaggle"


def test_data_factory_plan_rejects_v1_execution() -> None:
    from app.models import ContosoGenerationPlan, ContosoMlPlan, ContosoOutputPlan, ContosoScale, DataFactoryPlan

    contoso = ContosoGenerationPlan(
        scenario="retail.customer_satisfaction",
        generator="Contoso Forge Lite",
        seed=1,
        scale=ContosoScale(orders=10, customers=5, products=3, stores=1, days=30),
        ml=ContosoMlPlan(
            profile="causal-v1",
            positiveOutcomeRate=0.1,
            signalStrength=0.5,
            noiseLevel=0.1,
            target="customer dissatisfaction",
            primarySignal="delivery delay",
        ),
        output=ContosoOutputPlan(
            format="Parquet",
            destination="MotherDuck / DuckLake",
            durableZones=["Raw", "Gold"],
        ),
    )

    with pytest.raises(ValidationError):
        DataFactoryPlan(
            contoso=contoso,
            coreStages=[],
            mlStages=[],
            executionEnabled=True,
        )


def test_agent_snapshot_rejects_identity_mismatch(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    now = datetime.now(timezone.utc).isoformat()
    response = client.post(
        "/api/v1/agent/snapshot",
        headers={"Authorization": "Bearer test-token"},
        json={
            "machineId": "oracle-a",
            "collectedAt": now,
            "host": {
                "id": "oracle-b",
                "name": "oracle-b",
                "shape": "VM.Standard.A1.Flex",
                "ocpu": 2,
                "memoryGb": 12,
                "cpuPercent": 10,
                "memoryUsedGb": 2,
                "diskPercent": 10,
                "uptime": "1h",
                "k3sVersion": "v1.34",
                "diskUsedGb": 10,
                "diskTotalGb": 100,
            },
            "workloads": [],
            "namespaces": [],
            "maintenance": {
                "os": "Ubuntu",
                "kernel": "6.x",
                "updatesAvailable": 0,
                "securityUpdates": 0,
                "rebootRequired": False,
                "unusedImagesGb": 0,
                "prometheusGb": 0,
                "lokiGb": 0,
                "lastBackup": "unknown",
                "backupStatus": "unknown",
            },
        },
    )
    assert response.status_code == 422


def test_agent_snapshot_rejects_impossible_resource_values(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    now = datetime.now(timezone.utc).isoformat()
    response = client.post(
        "/api/v1/agent/snapshot",
        headers={"Authorization": "Bearer test-token"},
        json={
            "machineId": "oracle-bad-metrics",
            "collectedAt": now,
            "host": {
                "id": "oracle-bad-metrics",
                "name": "oracle-bad-metrics",
                "shape": "VM.Standard.A1.Flex",
                "ocpu": 2,
                "memoryGb": 12,
                "cpuPercent": 101,
                "memoryUsedGb": 13,
                "diskPercent": 120,
                "uptime": "1h",
                "k3sVersion": "v1.34",
                "diskUsedGb": 101,
                "diskTotalGb": 100,
            },
            "workloads": [],
            "namespaces": [],
            "maintenance": {
                "os": "Ubuntu",
                "kernel": "6.x",
                "updatesAvailable": 0,
                "securityUpdates": 0,
                "rebootRequired": False,
                "unusedImagesGb": 0,
                "prometheusGb": 0,
                "lokiGb": 0,
                "lastBackup": "unknown",
                "backupStatus": "unknown",
            },
        },
    )
    assert response.status_code == 422


def test_agent_snapshot_rejects_invalid_namespace_readiness(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    now = datetime.now(timezone.utc).isoformat()
    response = client.post(
        "/api/v1/agent/snapshot",
        headers={"Authorization": "Bearer test-token"},
        json={
            "machineId": "oracle-readiness",
            "collectedAt": now,
            "host": {
                "id": "oracle-readiness",
                "name": "oracle-readiness",
                "shape": "VM.Standard.A1.Flex",
                "ocpu": 2,
                "memoryGb": 12,
                "cpuPercent": 10,
                "memoryUsedGb": 2,
                "diskPercent": 10,
                "uptime": "1h",
                "k3sVersion": "v1.34",
                "diskUsedGb": 10,
                "diskTotalGb": 100,
            },
            "workloads": [],
            "namespaces": [
                {
                    "name": "airflow",
                    "podsReady": 3,
                    "podsTotal": 2,
                    "cpuMillicores": 0,
                    "memoryMb": 0,
                }
            ],
            "maintenance": {
                "os": "Ubuntu",
                "kernel": "6.x",
                "updatesAvailable": 0,
                "securityUpdates": 0,
                "rebootRequired": False,
                "unusedImagesGb": 0,
                "prometheusGb": 0,
                "lokiGb": 0,
                "lastBackup": "unknown",
                "backupStatus": "unknown",
            },
        },
    )
    assert response.status_code == 422


def test_future_heartbeat_is_not_considered_connected(monkeypatch) -> None:
    from datetime import timedelta

    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    future = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    response = client.post(
        "/api/v1/agent/heartbeat",
        headers={"Authorization": "Bearer test-token"},
        json={
            "agentVersion": "0.1.0",
            "machineId": "oracle-future",
            "status": "healthy",
            "k3sReachable": True,
            "sentAt": future,
        },
    )
    assert response.status_code == 204

    status_response = client.get("/api/v1/agent/status")
    assert status_response.status_code == 200
    assert status_response.json()["connected"] is False


def test_command_result_requires_running_state(monkeypatch) -> None:
    monkeypatch.setenv("REACTORACLE_AGENT_TOKEN", "test-token")
    created = client.post(
        "/api/v1/commands",
        json={"command": "vm.health_check", "machineId": "oracle-command-state"},
    )
    assert created.status_code == 202
    command_id = created.json()["id"]

    premature = client.post(
        f"/api/v1/agent/commands/{command_id}/result",
        headers={"Authorization": "Bearer test-token"},
        json={"status": "success", "result": {"ok": True}},
    )
    assert premature.status_code == 409

    leased = client.get(
        "/api/v1/agent/commands/next",
        params={"machineId": "oracle-command-state"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert leased.status_code == 200

    completed = client.post(
        f"/api/v1/agent/commands/{command_id}/result",
        headers={"Authorization": "Bearer test-token"},
        json={"status": "success", "result": {"ok": True}},
    )
    assert completed.status_code == 200

    repeated = client.post(
        f"/api/v1/agent/commands/{command_id}/result",
        headers={"Authorization": "Bearer test-token"},
        json={"status": "success", "result": {"ok": True}},
    )
    assert repeated.status_code == 409


def test_recent_command_limit_is_bounded() -> None:
    too_small = client.get("/api/v1/commands", params={"limit": 0})
    assert too_small.status_code == 422

    too_large = client.get("/api/v1/commands", params={"limit": 101})
    assert too_large.status_code == 422


def test_data_factory_ml_parameters_are_bounded() -> None:
    from app.models import ContosoMlPlan

    for field, value in (
        ("positiveOutcomeRate", 1.1),
        ("signalStrength", -0.1),
        ("noiseLevel", 2.0),
    ):
        kwargs = {
            "profile": "causal-v1",
            "positiveOutcomeRate": 0.1,
            "signalStrength": 0.5,
            "noiseLevel": 0.1,
            "target": "customer dissatisfaction",
            "primarySignal": "delivery delay",
        }
        kwargs[field] = value
        with pytest.raises(ValidationError):
            ContosoMlPlan(**kwargs)


def test_data_factory_output_rejects_duplicate_durable_zones() -> None:
    from app.models import ContosoOutputPlan

    with pytest.raises(ValidationError):
        ContosoOutputPlan(
            format="Parquet",
            destination="MotherDuck / DuckLake",
            durableZones=["Raw", "Gold", "Gold"],
        )


def test_openapi_exposes_only_allowlisted_command_surface() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]

    assert "/api/v1/execute" not in paths
    assert "/api/v1/shell" not in paths
    assert "/api/v1/terminal" not in paths

    assert "post" in paths["/api/v1/commands"]
    assert "get" in paths["/api/v1/commands"]
    assert "/api/v1/platform/architecture" in paths
    assert "/api/v1/platform/data-factory" in paths
    assert "/api/v1/platform/gold-catalog" in paths
    assert "/api/v1/platform/providers" in paths
