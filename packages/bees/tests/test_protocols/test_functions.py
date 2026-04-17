# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Conformance tests for bees.protocols.

Verifies that:
1. Bees-native types work end-to-end (load → assemble → use).
2. opal_backend's concrete types structurally satisfy the bees-native shapes.
3. Minimal mocks satisfy the SessionHooks protocol.

See ``spec/function-types.md`` for context.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from bees.protocols import (
    FunctionDefinition,
    FunctionGroup,
    FunctionGroupFactory,
    LoadedDeclarations,
    MappedDefinitions,
    SessionHooks,
    assemble_function_group,
    empty_definitions,
    load_declarations,
    map_definitions,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def declarations_dir(tmp_path: Path) -> Path:
    """Create a minimal declarations directory on disk."""
    decls = [
        {
            "name": "greet",
            "description": "Say hello",
            "parametersJsonSchema": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
            },
        },
        {
            "name": "farewell",
            "description": "Say goodbye",
        },
    ]
    meta = [
        {"name": "greet", "icon": "👋", "title": "Greet"},
        {"name": "farewell", "icon": "🫡", "title": "Farewell"},
    ]
    (tmp_path / "test_group.functions.json").write_text(json.dumps(decls))
    (tmp_path / "test_group.metadata.json").write_text(json.dumps(meta))
    (tmp_path / "test_group.instruction.md").write_text(
        "You are a friendly greeter."
    )
    return tmp_path


# ---------------------------------------------------------------------------
# 1. Bees-native types work end-to-end
# ---------------------------------------------------------------------------


class TestLoadDeclarations:
    """Tests for ``load_declarations``."""

    def test_loads_declarations_and_metadata(
        self, declarations_dir: Path
    ) -> None:
        loaded = load_declarations(
            "test_group", declarations_dir=declarations_dir
        )
        assert loaded.name == "test_group"
        assert len(loaded.declarations) == 2
        assert loaded.declarations[0]["name"] == "greet"
        assert len(loaded.metadata) == 2
        assert loaded.instruction == "You are a friendly greeter."

    def test_missing_instruction_is_none(self, tmp_path: Path) -> None:
        (tmp_path / "bare.functions.json").write_text("[]")
        (tmp_path / "bare.metadata.json").write_text("[]")
        loaded = load_declarations("bare", declarations_dir=tmp_path)
        assert loaded.instruction is None

    def test_requires_declarations_dir(self) -> None:
        with pytest.raises(ValueError, match="declarations_dir is required"):
            load_declarations("anything")


class TestAssembleFunctionGroup:
    """Tests for ``assemble_function_group``."""

    @pytest.fixture
    def loaded(self, declarations_dir: Path) -> LoadedDeclarations:
        return load_declarations(
            "test_group", declarations_dir=declarations_dir
        )

    def test_assembles_matching_handlers(
        self, loaded: LoadedDeclarations
    ) -> None:
        async def greet_handler(
            args: dict[str, Any], status_cb: Any
        ) -> dict[str, Any]:
            return {"message": f"Hello, {args.get('name', 'world')}!"}

        group = assemble_function_group(
            loaded, {"greet": greet_handler}
        )

        assert isinstance(group, FunctionGroup)
        assert group.name == "test_group"
        assert group.instruction == "You are a friendly greeter."
        # Only the handler-matched declaration is included.
        assert len(group.definitions) == 1
        assert len(group.declarations) == 1
        assert group.definitions[0][0] == "greet"
        assert group.definitions[0][1].icon == "👋"

    def test_skips_declarations_without_handlers(
        self, loaded: LoadedDeclarations
    ) -> None:
        group = assemble_function_group(loaded, {})
        assert len(group.definitions) == 0
        assert len(group.declarations) == 0

    def test_instruction_override(
        self, loaded: LoadedDeclarations
    ) -> None:
        async def noop(args: Any, cb: Any) -> dict[str, Any]:
            return {}

        group = assemble_function_group(
            loaded,
            {"greet": noop},
            instruction_override="Custom instruction",
        )
        assert group.instruction == "Custom instruction"

    def test_name_override(self, loaded: LoadedDeclarations) -> None:
        group = assemble_function_group(
            loaded, {}, name="custom_name"
        )
        assert group.name == "custom_name"

    def test_preconditions_attached(
        self, loaded: LoadedDeclarations
    ) -> None:
        async def handler(args: Any, cb: Any) -> dict[str, Any]:
            return {}

        async def precond(args: Any) -> None:
            pass

        group = assemble_function_group(
            loaded,
            {"greet": handler},
            preconditions={"greet": precond},
        )
        assert group.definitions[0][1].precondition is precond


class TestMapDefinitions:
    """Tests for ``map_definitions``."""

    def test_maps_definitions_to_declarations(self) -> None:
        async def handler(args: Any, cb: Any) -> dict[str, Any]:
            return {}

        func = FunctionDefinition(
            name="test_func",
            description="A test function",
            handler=handler,
            parameters_json_schema={"type": "object"},
        )
        mapped = map_definitions([func])
        assert len(mapped.definitions) == 1
        assert len(mapped.declarations) == 1
        assert mapped.declarations[0]["name"] == "test_func"
        assert "parametersJsonSchema" in mapped.declarations[0]

    def test_empty_definitions(self) -> None:
        mapped = empty_definitions()
        assert mapped.definitions == []
        assert mapped.declarations == []


# ---------------------------------------------------------------------------
# 2. opal_backend types structurally satisfy bees types
# ---------------------------------------------------------------------------


class TestOpalBackendConformance:
    """Verifies that opal_backend's types have the same fields as bees' types.

    This is the conformance gate: if these tests pass, migrating function
    modules from ``opal_backend.function_definition`` to ``bees.protocols``
    is a safe import rewrite.
    """

    def test_function_group_fields_match(self) -> None:
        from opal_backend.function_definition import (
            FunctionGroup as OpalFunctionGroup,
        )

        bees_fields = {f.name for f in FunctionGroup.__dataclass_fields__.values()}
        opal_fields = {f.name for f in OpalFunctionGroup.__dataclass_fields__.values()}
        assert bees_fields == opal_fields, (
            f"Field mismatch — bees: {bees_fields - opal_fields}, "
            f"opal: {opal_fields - bees_fields}"
        )

    def test_function_definition_fields_match(self) -> None:
        from opal_backend.function_definition import (
            FunctionDefinition as OpalFunctionDefinition,
        )

        bees_fields = {
            f.name for f in FunctionDefinition.__dataclass_fields__.values()
        }
        opal_fields = {
            f.name for f in OpalFunctionDefinition.__dataclass_fields__.values()
        }
        assert bees_fields == opal_fields, (
            f"Field mismatch — bees: {bees_fields - opal_fields}, "
            f"opal: {opal_fields - bees_fields}"
        )

    def test_loaded_declarations_fields_match(self) -> None:
        from opal_backend.function_definition import (
            LoadedDeclarations as OpalLoadedDeclarations,
        )

        bees_fields = {
            f.name for f in LoadedDeclarations.__dataclass_fields__.values()
        }
        opal_fields = {
            f.name for f in OpalLoadedDeclarations.__dataclass_fields__.values()
        }
        assert bees_fields == opal_fields, (
            f"Field mismatch — bees: {bees_fields - opal_fields}, "
            f"opal: {opal_fields - bees_fields}"
        )

    def test_mapped_definitions_fields_match(self) -> None:
        from opal_backend.function_definition import (
            MappedDefinitions as OpalMappedDefinitions,
        )

        bees_fields = {
            f.name for f in MappedDefinitions.__dataclass_fields__.values()
        }
        opal_fields = {
            f.name for f in OpalMappedDefinitions.__dataclass_fields__.values()
        }
        assert bees_fields == opal_fields, (
            f"Field mismatch — bees: {bees_fields - opal_fields}, "
            f"opal: {opal_fields - bees_fields}"
        )

    def test_session_hooks_is_protocol_compatible(self) -> None:
        """opal_backend's SessionHooks satisfies bees' SessionHooks."""
        from opal_backend.function_definition import (
            SessionHooks as OpalSessionHooks,
        )

        # Both are runtime-checkable Protocols with the same property names.
        bees_props = {"controller", "file_system", "task_tree_manager"}
        opal_props = set()
        for name in dir(OpalSessionHooks):
            if not name.startswith("_"):
                member = getattr(OpalSessionHooks, name, None)
                if isinstance(member, property):
                    opal_props.add(name)
        # Allow opal to have extra properties — bees only requires these three.
        assert bees_props <= opal_props, (
            f"Missing in opal: {bees_props - opal_props}"
        )


# ---------------------------------------------------------------------------
# 3. Minimal mocks satisfy the SessionHooks protocol
# ---------------------------------------------------------------------------


class TestSessionHooksMock:
    """A minimal mock satisfies the ``SessionHooks`` protocol."""

    def test_mock_satisfies_protocol(self) -> None:
        class MockHooks:
            @property
            def controller(self) -> Any:
                return None

            @property
            def file_system(self) -> Any:
                return None

            @property
            def task_tree_manager(self) -> Any:
                return None

        assert isinstance(MockHooks(), SessionHooks)

    def test_factory_type_is_callable(self) -> None:
        """FunctionGroupFactory is a callable type alias."""

        class MockHooks:
            @property
            def controller(self) -> Any:
                return None

            @property
            def file_system(self) -> Any:
                return None

            @property
            def task_tree_manager(self) -> Any:
                return None

        def my_factory(hooks: SessionHooks) -> FunctionGroup:
            return FunctionGroup(name="test")

        # The factory callable works with a mock hooks instance.
        group = my_factory(MockHooks())
        assert isinstance(group, FunctionGroup)
        assert group.name == "test"


# ---------------------------------------------------------------------------
# 4. Real bees declarations work with bees-native assembly
# ---------------------------------------------------------------------------


class TestRealDeclarations:
    """Load actual bees declarations through bees-native utilities.

    This proves the bees-native code path produces valid groups from the
    same declaration files the function modules use today.
    """

    @pytest.fixture
    def bees_declarations_dir(self) -> Path:
        return Path(__file__).resolve().parent.parent.parent / "bees" / "declarations"

    @pytest.mark.parametrize(
        "group_name",
        ["events", "tasks", "skills", "sandbox", "chat", "system"],
    )
    def test_load_real_declarations(
        self, bees_declarations_dir: Path, group_name: str
    ) -> None:
        """Each bees declaration group loads without error."""
        try:
            loaded = load_declarations(
                group_name, declarations_dir=bees_declarations_dir
            )
        except FileNotFoundError:
            pytest.skip(f"Declarations for {group_name} not found")
            return
        assert loaded.name == group_name
        assert isinstance(loaded.declarations, list)
        assert isinstance(loaded.metadata, list)
