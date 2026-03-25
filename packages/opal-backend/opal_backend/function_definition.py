# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Types and helpers for defining agent functions.

Port of ``function-definition.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Provides the types and helpers that
the Loop uses to declare and dispatch function calls.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable, TypedDict

# Types matching the Gemini API function declaration format.
FunctionDeclaration = dict[str, Any]

# Options for status update callbacks, matching TS StatusUpdateCallbackOptions.
class StatusUpdateOptions(TypedDict, total=False):
    is_thought: bool
    expected_duration_in_sec: int


# A callback that allows function handlers to update their status.
# When status is None, it means "clear my status".
StatusUpdateCallback = Callable[[str | None, StatusUpdateOptions | None], None]

# Handler: receives parsed args + status callback, returns dict response.
FunctionHandler = Callable[
    [dict[str, Any], StatusUpdateCallback],
    Awaitable[dict[str, Any]],
]

# Precondition: receives args, raises SuspendError if the function
# should not proceed (e.g. consent not yet granted).
PreconditionHandler = Callable[
    [dict[str, Any]],
    Awaitable[None],
]


@dataclass
class FunctionDefinition:
    """A single function the agent can call.

    Mirrors ``FunctionDefinition`` from ``function-definition.ts``.
    """

    name: str
    description: str
    handler: FunctionHandler
    precondition: PreconditionHandler | None = None
    parameters_json_schema: dict[str, Any] | None = None
    response_json_schema: dict[str, Any] | None = None
    icon: str | None = None
    title: str | None = None


@dataclass
class MappedDefinitions:
    """Separated declarations and definitions for a set of functions.

    - ``definitions``: list of (name, FunctionDefinition) for dispatch
    - ``declarations``: list of Gemini FunctionDeclaration dicts for the API
    """

    definitions: list[tuple[str, FunctionDefinition]] = field(
        default_factory=list
    )
    declarations: list[FunctionDeclaration] = field(default_factory=list)


@dataclass
class FunctionGroup(MappedDefinitions):
    """A group of related functions with an optional system instruction.

    Function groups compose the agent's toolset. The Loop merges all
    groups into a single tool set and concatenates their instructions.

    The ``name`` identifies the group for filtering (e.g. ``"system"``,
    ``"generate"``, ``"chat"``). When a function filter pattern like
    ``"system.*"`` is applied, it matches against this name.
    """

    name: str | None = None
    instruction: str | None = None


def map_definitions(functions: list[FunctionDefinition]) -> MappedDefinitions:
    """Convert a list of FunctionDefinitions into MappedDefinitions.

    Separates the handler (for dispatch) from the declaration (for the API).
    """
    definitions: list[tuple[str, FunctionDefinition]] = [
        (f.name, f) for f in functions
    ]
    declarations: list[FunctionDeclaration] = []
    for f in functions:
        decl: FunctionDeclaration = {
            "name": f.name,
            "description": f.description,
        }
        if f.parameters_json_schema:
            decl["parametersJsonSchema"] = f.parameters_json_schema
        if f.response_json_schema:
            decl["responseJsonSchema"] = f.response_json_schema
        declarations.append(decl)
    return MappedDefinitions(definitions=definitions, declarations=declarations)


def empty_definitions() -> MappedDefinitions:
    """Return an empty MappedDefinitions."""
    return MappedDefinitions()


# ---------------------------------------------------------------------------
# Declaration-driven assembly (JSON as source of truth)
# ---------------------------------------------------------------------------

import json
from pathlib import Path

from importlib import resources

_DECLARATIONS_DIR = resources.files("opal_backend") / "declarations"


@dataclass
class LoadedDeclarations:
    """Raw declarations, metadata, and instruction loaded from JSON/md."""

    name: str
    declarations: list[FunctionDeclaration]
    metadata: list[dict[str, Any]]
    instruction: str | None


def load_declarations(
    group: str,
    *,
    declarations_dir: Path | None = None,
) -> LoadedDeclarations:
    """Load declarations, metadata, and instruction for a function group.

    Reads from ``<declarations_dir>/<group>.*`` files. Defaults to
    ``opal-backend/declarations/``.
    """
    root = declarations_dir or _DECLARATIONS_DIR
    decls = json.loads(
        (root / f"{group}.functions.json").read_text()
    )
    meta = json.loads(
        (root / f"{group}.metadata.json").read_text()
    )
    instr_path = root / f"{group}.instruction.md"
    try:
        instr = instr_path.read_text()
    except FileNotFoundError:
        instr = None
    return LoadedDeclarations(
        name=group, declarations=decls, metadata=meta, instruction=instr
    )


def assemble_function_group(
    loaded: LoadedDeclarations,
    handlers: dict[str, FunctionHandler],
    *,
    name: str | None = None,
    instruction_override: str | None = None,
    preconditions: dict[str, "PreconditionHandler"] | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup from loaded JSON declarations and a handler map.

    Only declarations that have a matching handler are included.
    This allows partial coverage (e.g., Python implements 2 of 6
    generate functions while the rest live in separate modules).

    Args:
        loaded: Declarations loaded via ``load_declarations``.
        handlers: Map of function name to async handler.
        name: Optional group name for identification and filtering.
            Defaults to ``loaded.name`` if not provided.
        instruction_override: If provided, replaces the loaded instruction
            (used when the instruction needs runtime interpolation).
        preconditions: Optional map of function name to precondition handler.
    """
    metadata_by_name: dict[str, dict[str, Any]] = {
        entry["name"]: entry for entry in loaded.metadata
    }
    preconds = preconditions or {}

    definitions: list[tuple[str, FunctionDefinition]] = []
    declarations: list[FunctionDeclaration] = []

    for decl in loaded.declarations:
        fname = decl["name"]
        handler = handlers.get(fname)
        if handler is None:
            continue  # Skip declarations without handlers.

        meta = metadata_by_name.get(fname, {})
        func_def = FunctionDefinition(
            name=fname,
            description=decl.get("description", ""),
            handler=handler,
            precondition=preconds.get(fname),
            parameters_json_schema=decl.get("parametersJsonSchema"),
            response_json_schema=decl.get("responseJsonSchema"),
            icon=meta.get("icon"),
            title=meta.get("title"),
        )
        definitions.append((fname, func_def))
        declarations.append(decl)

    instruction = instruction_override if instruction_override is not None else loaded.instruction
    group_name = name if name is not None else loaded.name

    return FunctionGroup(
        name=group_name,
        definitions=definitions,
        declarations=declarations,
        instruction=instruction,
    )
