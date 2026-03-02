# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Shared parameter schemas for agent function definitions.

Port of ``statusUpdateSchema``, ``taskIdSchema``, and ``fileNameSchema``
from ``functions/system.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

These are spread into every function's
``parameters_json_schema`` to ensure consistent descriptions across all
function groups.

Usage::

    from ..shared_schemas import (
        STATUS_UPDATE_SCHEMA,
        TASK_ID_SCHEMA,
        FILE_NAME_SCHEMA,
    )

    parameters_json_schema = {
        "type": "object",
        "properties": {
            "prompt": { ... },
            **STATUS_UPDATE_SCHEMA,
            **TASK_ID_SCHEMA,
            **FILE_NAME_SCHEMA,
        },
    }
"""

STATUS_UPDATE_SCHEMA: dict[str, dict[str, str]] = {
    "status_update": {
        "type": "string",
        "description": (
            "A status update to show in the UI that provides more detail "
            "on the reason why this function was called. For example, "
            "'Creating random values', 'Writing the memo', "
            "'Generating videos', 'Making music', etc."
        ),
    },
}

TASK_ID_SCHEMA: dict[str, dict[str, str]] = {
    "task_id": {
        "type": "string",
        "description": (
            'If applicable, the "task_id" value of the relevant task '
            "in the task tree."
        ),
    },
}

FILE_NAME_SCHEMA: dict[str, dict[str, str]] = {
    "file_name": {
        "type": "string",
        "description": (
            "Optional name for the generated file (without extension). "
            "Use snake_case for naming. The system will automatically "
            "add the appropriate extension based on the file type."
        ),
    },
}
