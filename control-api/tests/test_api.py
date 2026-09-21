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
