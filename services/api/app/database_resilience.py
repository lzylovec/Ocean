from __future__ import annotations

import time
from collections.abc import Callable

from fastapi import HTTPException, status
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError


class DatabaseUnavailableError(RuntimeError):
    pass


_DATABASE_ERROR_SNIPPETS = (
    "failed to resolve host",
    "could not receive data from server",
    "server closed the connection unexpectedly",
    "name or service not known",
    "temporary failure in name resolution",
    "nodename nor servname provided",
    "connection refused",
    "connection timed out",
    "operation timed out",
    "ssl syscall error",
    "connection not open",
)


def is_database_unavailable_error(error: Exception) -> bool:
    if isinstance(error, DatabaseUnavailableError):
        return True

    if isinstance(error, (OperationalError, InterfaceError)):
        return True

    if isinstance(error, DBAPIError) and error.connection_invalidated:
        return True

    message = str(error).lower()
    return any(snippet in message for snippet in _DATABASE_ERROR_SNIPPETS)


def run_database_read(
    operation: Callable[[], object],
    *,
    attempts: int = 2,
    retry_delay_seconds: float = 0.35,
):
    last_error: Exception | None = None
    normalized_attempts = max(attempts, 1)

    for attempt in range(normalized_attempts):
        try:
            return operation()
        except Exception as error:
            if not is_database_unavailable_error(error):
                raise
            last_error = error
            if attempt + 1 < normalized_attempts:
                time.sleep(retry_delay_seconds)

    raise DatabaseUnavailableError("Database read is temporarily unavailable.") from last_error


def run_database_write(operation: Callable[[], object]):
    try:
        return operation()
    except Exception as error:
        if is_database_unavailable_error(error):
            raise DatabaseUnavailableError(
                "Database write is temporarily unavailable."
            ) from error
        raise


def raise_database_http_error(message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "code": "database_unavailable",
            "message": message,
            "retryable": True,
        },
    )
