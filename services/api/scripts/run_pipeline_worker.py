from __future__ import annotations

import argparse
import logging
import os
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from socket import gethostname

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from services.api.app.config import settings
from services.api.app.database import init_database
from services.api.app.services.pipeline_jobs import pipeline_job_service
from services.api.app.services.pipeline_workers import (
    PipelineWorkerHeartbeatPayload,
    pipeline_worker_service,
)

logger = logging.getLogger("ocean.pipeline_worker")


@dataclass
class WorkerRuntimeState:
    worker_id: str
    status: str = "idle"
    current_job_id: str | None = None
    last_claimed_job_id: str | None = None
    last_completed_job_id: str | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)

    def snapshot(self) -> PipelineWorkerHeartbeatPayload:
        with self.lock:
            return PipelineWorkerHeartbeatPayload(
                worker_id=self.worker_id,
                status=self.status,
                current_job_id=self.current_job_id,
                last_claimed_job_id=self.last_claimed_job_id,
                last_completed_job_id=self.last_completed_job_id,
            )

    def set_idle(self, *, completed_job_id: str | None = None) -> None:
        with self.lock:
            self.status = "idle"
            self.current_job_id = None
            if completed_job_id:
                self.last_completed_job_id = completed_job_id

    def set_running(self, job_id: str) -> None:
        with self.lock:
            self.status = "running"
            self.current_job_id = job_id
            self.last_claimed_job_id = job_id

    def set_stopped(self) -> None:
        with self.lock:
            self.status = "stopped"
            self.current_job_id = None


def _heartbeat_loop(stop_event: threading.Event, state: WorkerRuntimeState) -> None:
    interval = max(settings.pipeline_worker_heartbeat_seconds, 1)
    while not stop_event.is_set():
        try:
            pipeline_worker_service.heartbeat(state.snapshot())
        except Exception:
            logger.exception("Worker heartbeat failed.")
        stop_event.wait(interval)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Ocean async pipeline worker.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Claim and process at most one queued job, then exit.",
    )
    parser.add_argument(
        "--max-jobs",
        type=int,
        default=0,
        help="Process at most N jobs before exiting. 0 means unlimited.",
    )
    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=settings.pipeline_worker_poll_seconds,
        help="Idle polling interval in seconds.",
    )
    return parser.parse_args()


def _retry_delay_seconds(args: argparse.Namespace) -> int:
    return max(args.poll_seconds, 5)


def _ensure_database_ready(
    *,
    args: argparse.Namespace,
    stop_event: threading.Event | None = None,
) -> bool:
    retry_delay = _retry_delay_seconds(args)
    while True:
        try:
            init_database()
            return True
        except Exception:
            logger.exception(
                "Worker failed to initialize database, retrying in %s seconds.",
                retry_delay,
            )
            if args.once:
                return False
            if stop_event is not None and stop_event.wait(retry_delay):
                return False
            time.sleep(retry_delay) if stop_event is None else None


def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    processed_jobs = 0
    worker_state = WorkerRuntimeState(
        worker_id=f"{gethostname()}:{os.getpid()}",
    )
    stop_event = threading.Event()
    heartbeat_thread = threading.Thread(
        target=_heartbeat_loop,
        args=(stop_event, worker_state),
        daemon=True,
    )
    logger.info(
        "Pipeline worker started. once=%s max_jobs=%s poll_seconds=%s",
        args.once,
        args.max_jobs,
        args.poll_seconds,
    )

    if not _ensure_database_ready(args=args, stop_event=stop_event):
        return

    heartbeat_thread.start()

    try:
        while True:
            try:
                expired_jobs = pipeline_job_service.fail_expired_running_jobs()
                if expired_jobs:
                    logger.warning("Recovered %s expired running jobs.", expired_jobs)

                job_id = pipeline_job_service.claim_next_job()
                if job_id is None:
                    worker_state.set_idle()
                    if args.once:
                        logger.info("No queued jobs found. Worker exits.")
                        break
                    if args.max_jobs and processed_jobs >= args.max_jobs:
                        logger.info("Processed %s jobs. Worker exits.", processed_jobs)
                        break
                    time.sleep(max(args.poll_seconds, 1))
                    continue

                worker_state.set_running(job_id)
                logger.info("Claimed job %s", job_id)
                pipeline_job_service.run_job(job_id, already_claimed=True)
                processed_jobs += 1
                worker_state.set_idle(completed_job_id=job_id)
                logger.info("Finished job %s", job_id)

                if args.once:
                    break
                if args.max_jobs and processed_jobs >= args.max_jobs:
                    logger.info("Processed %s jobs. Worker exits.", processed_jobs)
                    break
            except Exception:
                worker_state.set_idle()
                logger.exception(
                    "Worker loop failed, retrying in %s seconds.",
                    _retry_delay_seconds(args),
                )
                if args.once:
                    break
                if not _ensure_database_ready(args=args, stop_event=stop_event):
                    break
    finally:
        worker_state.set_stopped()
        try:
            pipeline_worker_service.heartbeat(worker_state.snapshot())
        except Exception:
            logger.exception("Final worker heartbeat failed during shutdown.")
        stop_event.set()
        heartbeat_thread.join(timeout=1)


if __name__ == "__main__":
    main()
