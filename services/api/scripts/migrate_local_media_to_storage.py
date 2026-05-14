from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from services.api.app.services.media_migration import media_migration_service


def main() -> None:
    result = media_migration_service.migrate_local_media_to_storage()

    print(
        "migrated_original="
        f"{result.migrated_original} migrated_enhanced={result.migrated_enhanced} "
        f"updated_jobs={result.updated_jobs}"
    )


if __name__ == "__main__":
    main()
