import os
import shutil
from typing import Any


def on_starting(server: Any) -> None:
    """Reset the Prometheus multiprocess directory for this process generation.

    Without this, .db files left behind by a previous container run (different
    worker PIDs) get picked up by prometheus_client's MultiProcessCollector and
    silently inflate metrics with dead workers' last-known values.
    """
    multiproc_dir = os.environ.get("PROMETHEUS_MULTIPROC_DIR")
    if not multiproc_dir:
        return
    shutil.rmtree(multiproc_dir, ignore_errors=True)
    os.makedirs(multiproc_dir, exist_ok=True)


def child_exit(server: Any, worker: Any) -> None:
    """Release a worker's metric files when it exits or is recycled."""
    if not os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        return
    from prometheus_client import multiprocess

    multiprocess.mark_process_dead(worker.pid)
