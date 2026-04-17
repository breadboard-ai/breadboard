# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees-native types for function declaration, assembly, and dispatch.

These mirror the shapes in ``opal_backend.function_definition`` so that
bees' function modules can import from here instead. Python's structural
subtyping means opal_backend's concrete types satisfy these definitions
without modification.

See ``spec/function-types.md`` for design rationale.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Protocol, TypedDict, runtime_checkable

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

FunctionDeclaration = dict[str, Any]
"""A Gemini-format function declaration (JSON Schema)."""

StatusUpdateCallback = Callable[[str | None, "StatusUpdateOptions | None"], None]
"""Callback for function handlers to report status updates."""

FunctionHandler = Callable[
    [dict[str, Any], StatusUpdateCallback],
    Awaitable[dict[str, Any]],
]
"""Async handler: receives parsed args + status callback, returns response."""

PreconditionHandler = Callable[
    [dict[str, Any]],
    Awaitable[None],
]
"""Async precondition: receives args, raises on failure."""


class StatusUpdateOptions(TypedDict, total=False):
    """Options for status update callbacks."""

    is_thought: bool
    expected_duration_in_sec: int


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class FunctionDefinition:
    """A single function the agent can call.

    Mirrors ``opal_backend.function_definition.FunctionDefinition``.
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

    - ``definitions``: list of (name, FunctionDefinition) for dispatch.
    - ``declarations``: list of Gemini FunctionDeclaration dicts for the API.
    """

    definitions: list[tuple[str, FunctionDefinition]] = field(
        default_factory=list,
    )
    declarations: list[FunctionDeclaration] = field(default_factory=list)


@dataclass
class FunctionGroup(MappedDefinitions):
    """A group of related functions with an optional system instruction.

    Mirrors ``opal_backend.function_definition.FunctionGroup``.
    """

    name: str | None = None
    instruction: str | None = None


@dataclass
class LoadedDeclarations:
    """Raw declarations, metadata, and instruction loaded from JSON/md."""

    name: str
    declarations: list[FunctionDeclaration]
    metadata: list[dict[str, Any]]
    instruction: str | None


# ---------------------------------------------------------------------------
# Protocols
# ---------------------------------------------------------------------------


@runtime_checkable
class SessionHooks(Protocol):
    """Contract for session-internal objects exposed to function group factories.

    Bees' function modules accept this in their factory signatures but
    get their dependencies through closure — the hooks parameter is
    structurally required but unused. Properties are typed as ``Any``
    for decoupling; a richer ``FileSystem`` protocol is a separate spec.
    """

    @property
    def controller(self) -> Any:
        """The loop controller."""
        ...

    @property
    def file_system(self) -> Any:
        """The agent file system."""
        ...

    @property
    def task_tree_manager(self) -> Any:
        """The task tree manager."""
        ...


FunctionGroupFactory = Callable[[SessionHooks], FunctionGroup]
"""A callable that receives session hooks and returns a FunctionGroup."""


# ---------------------------------------------------------------------------
# Declaration loading and assembly
# ---------------------------------------------------------------------------


def load_declarations(
    group: str,
    *,
    declarations_dir: Path | None = None,
) -> LoadedDeclarations:
    """Load declarations, metadata, and instruction for a function group.

    Reads ``<declarations_dir>/<group>.functions.json``,
    ``<group>.metadata.json``, and ``<group>.instruction.md``.

    Args:
        group: The function group name (e.g. ``"events"``).
        declarations_dir: Directory containing declaration files.
            Required — there is no default directory in the bees package.
    """
    if declarations_dir is None:
        raise ValueError(
            "declarations_dir is required — bees does not have a default "
            "declarations directory."
        )

    decls = json.loads(
        (declarations_dir / f"{group}.functions.json").read_text(),
    )
    meta = json.loads(
        (declarations_dir / f"{group}.metadata.json").read_text(),
    )
    instr_path = declarations_dir / f"{group}.instruction.md"
    try:
        instr = instr_path.read_text()
    except FileNotFoundError:
        instr = None

    return LoadedDeclarations(
        name=group,
        declarations=decls,
        metadata=meta,
        instruction=instr,
    )


def assemble_function_group(
    loaded: LoadedDeclarations,
    handlers: dict[str, FunctionHandler],
    *,
    name: str | None = None,
    instruction_override: str | None = None,
    preconditions: dict[str, PreconditionHandler] | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup from loaded declarations and a handler map.

    Only declarations that have a matching handler are included. This allows
    partial coverage — a module can implement a subset of the declared
    functions.

    Args:
        loaded: Declarations loaded via ``load_declarations``.
        handlers: Map of function name to async handler.
        name: Group name for identification and filtering.
            Defaults to ``loaded.name``.
        instruction_override: Replaces the loaded instruction when the
            instruction template needs runtime interpolation.
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
            continue

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

    instruction = (
        instruction_override
        if instruction_override is not None
        else loaded.instruction
    )
    group_name = name if name is not None else loaded.name

    return FunctionGroup(
        name=group_name,
        definitions=definitions,
        declarations=declarations,
        instruction=instruction,
    )


def map_definitions(
    functions: list[FunctionDefinition],
) -> MappedDefinitions:
    """Convert a list of FunctionDefinitions into MappedDefinitions."""
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
