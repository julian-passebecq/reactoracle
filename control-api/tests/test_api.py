from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_overview_contract() -> None:
    response = client.get("/api/v1/overview")
    assert response.status_code == 200
    body = response.json()
    assert body["vm"]["provider"] == "oci"
    assert body["vm"]["memoryGb"] > 0
    assert isinstance(body["workloads"], list)
    assert isinstance(body["namespaces"], list)


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


def test_k8s_restart_rejects_jobs_and_extra_arguments() -> None:
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
