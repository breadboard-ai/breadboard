# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees-native protocols and types.

Each module defines the types for one boundary:

- ``functions`` — function declaration, assembly, and dispatch.
- (future) ``session`` — SessionRunner, SessionConfiguration, etc.
- (future) ``filesystem`` — FileSystem protocol.
"""

from bees.protocols.functions import (
    FunctionDeclaration,
    FunctionDefinition,
    FunctionGroup,
    FunctionGroupFactory,
    FunctionHandler,
    LoadedDeclarations,
    MappedDefinitions,
    PreconditionHandler,
    SessionHooks,
    StatusUpdateCallback,
    StatusUpdateOptions,
    assemble_function_group,
    empty_definitions,
    load_declarations,
    map_definitions,
)

__all__ = [
    "FunctionDeclaration",
    "FunctionDefinition",
    "FunctionGroup",
    "FunctionGroupFactory",
    "FunctionHandler",
    "LoadedDeclarations",
    "MappedDefinitions",
    "PreconditionHandler",
    "SessionHooks",
    "StatusUpdateCallback",
    "StatusUpdateOptions",
    "assemble_function_group",
    "empty_definitions",
    "load_declarations",
    "map_definitions",
]
