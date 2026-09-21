from datetime import datetime, timedelta, timezone

from app.state import COMMAND_QUEUE_TTL_SECONDS, ControlPlaneStore


def test_stale_queued_command_expires_before_agent_lease() -> None:
    store = ControlPlaneStore()
    created_at = datetime.now(timezone.utc) - timedelta(seconds=COMMAND_QUEUE_TTL_SECONDS + 1)
    run = store.create_command(
        "oracle-a1-01",
        "vm.health_check",
        created_at=created_at,
    )

    leased = store.lease_next_command("oracle-a1-01", now=datetime.now(timezone.utc))
    assert leased is None

    expired = store.get_command(run.id)
    assert expired is not None
    assert expired.status == "failed"
    assert expired.error == "Command expired before the agent leased it."
    assert expired.completedAt is not None


def test_fresh_queued_command_can_be_leased() -> None:
    store = ControlPlaneStore()
    now = datetime.now(timezone.utc)
    run = store.create_command(
        "oracle-a1-01",
        "vm.health_check",
        created_at=now - timedelta(seconds=COMMAND_QUEUE_TTL_SECONDS - 1),
    )

    leased = store.lease_next_command("oracle-a1-01", now=now)
    assert leased is not None
    assert leased.id == run.id

    running = store.get_command(run.id)
    assert running is not None
    assert running.status == "running"


def test_expired_command_does_not_block_next_fresh_command() -> None:
    store = ControlPlaneStore()
    now = datetime.now(timezone.utc)
    expired = store.create_command(
        "oracle-a1-01",
        "vm.health_check",
        created_at=now - timedelta(seconds=COMMAND_QUEUE_TTL_SECONDS + 30),
    )
    fresh = store.create_command(
        "oracle-a1-01",
        "vm.health_check",
        created_at=now,
    )

    leased = store.lease_next_command("oracle-a1-01", now=now)
    assert leased is not None
    assert leased.id == fresh.id

    expired_run = store.get_command(expired.id)
    assert expired_run is not None
    assert expired_run.status == "failed"


def test_stale_command_status_read_expires_it() -> None:
    store = ControlPlaneStore()
    now = datetime.now(timezone.utc)
    run = store.create_command(
        "oracle-a1-01",
        "vm.health_check",
        created_at=now - timedelta(seconds=COMMAND_QUEUE_TTL_SECONDS + 5),
    )

    expired = store.get_command(run.id)
    assert expired is not None
    assert expired.status == "failed"
    assert expired.error == "Command expired before the agent leased it."


def test_recent_commands_reports_expired_queue_entries_as_failed() -> None:
    store = ControlPlaneStore()
    now = datetime.now(timezone.utc)
    run = store.create_command(
        "oracle-a1-01",
        "vm.health_check",
        created_at=now - timedelta(seconds=COMMAND_QUEUE_TTL_SECONDS + 5),
    )

    recent = store.recent_commands()
    assert len(recent) == 1
    assert recent[0].id == run.id
    assert recent[0].status == "failed"
