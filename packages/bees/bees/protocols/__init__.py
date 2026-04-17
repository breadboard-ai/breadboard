# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees-native protocols and types.

Each module defines the types for one boundary:

- ``functions`` — function declaration, assembly, and dispatch.
- ``filesystem`` — FileSystem protocol and supporting types.
- ``handler_types`` — suspend/resume, termination, and context injection.
- (future) ``session`` — SessionRunner, SessionConfiguration, etc.
"""

from bees.protocols.filesystem import (
    DEFAULT_EXTENSION,
    DEFAULT_MIME_TYPE,
    KNOWN_TYPES,
    FileDescriptor,
    FileSystem,
    FileSystemSnapshot,
    SystemFileGetter,
    file_descriptor_to_part,
)
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
from bees.protocols.handler_types import (
    AgentResult,
    ChatEntryCallback,
    ChoiceItem,
    CONTEXT_PARTS_KEY,
    FileData,
    LLMContent,
    SessionTerminator,
    SuspendError,
    SuspendEvent,
    WaitForChoiceEvent,
    WaitForInputEvent,
)

__all__ = [
    # filesystem
    "DEFAULT_EXTENSION",
    "DEFAULT_MIME_TYPE",
    "FileDescriptor",
    "FileSystem",
    "FileSystemSnapshot",
    "KNOWN_TYPES",
    "SystemFileGetter",
    "file_descriptor_to_part",
    # functions
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
    # handler types
    "AgentResult",
    "ChatEntryCallback",
    "ChoiceItem",
    "CONTEXT_PARTS_KEY",
    "FileData",
    "LLMContent",
    "SessionTerminator",
    "SuspendError",
    "SuspendEvent",
    "WaitForChoiceEvent",
    "WaitForInputEvent",
]
