# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Function definitions and groups for the agent loop.

Port of ``function-definition.ts`` — provides the types and helpers that
the Loop uses to declare and dispatch function calls.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

# Types matching the Gemini API function declaration format.
FunctionDeclaration = dict[str, Any]

# A callback that allows function handlers to update their status.
# When status is None, it means "clear my status".
StatusUpdateCallback = Callable[[str | None], None]

# Handler: receives parsed args + status callback, returns dict response.
FunctionHandler = Callable[
    [dict[str, Any], StatusUpdateCallback],
    Awaitable[dict[str, Any]],
]


@dataclass
class FunctionDefinition:
    """A single function the agent can call.

    Mirrors ``FunctionDefinition`` from ``function-definition.ts``.
    """

    name: str
    description: str
    handler: FunctionHandler
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
    """

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
