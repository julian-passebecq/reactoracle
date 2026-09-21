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
    assert overview["workloads"][0]["name"] == "grafana"
