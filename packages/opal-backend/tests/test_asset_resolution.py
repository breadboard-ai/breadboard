# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for asset resolution in template substitution.

Verifies that ``{\"type\": \"asset\"}`` template placeholders in
node prompts are resolved by looking up ``graph.assets[path].data``.
"""

from __future__ import annotations

import pytest

from opal_backend.node_handlers import (
    _build_segments_from_inputs,
    _collect_asset_segments,
    _get_last_non_metadata,
    _resolve_asset_text,
    _substitute_template,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEXT_ASSET = {
    "@a/notes": {
        "metadata": {"title": "Notes", "type": "content"},
        "data": [
            {"role": "user", "parts": [{"text": "These are my notes."}]},
        ],
    },
}

IMAGE_ASSET = {
    "@a/photo": {
        "metadata": {"title": "Photo", "type": "file"},
        "data": [
            {
                "role": "user",
                "parts": [
                    {"inlineData": {"data": "iVBORw0KGgo=", "mimeType": "image/png"}},
                ],
            },
        ],
    },
}

MIXED_ASSET = {
    "@a/doc": {
        "metadata": {"title": "Document", "type": "content"},
        "data": [
            {
                "role": "user",
                "parts": [
                    {"text": "Summary of the document."},
                    {"inlineData": {"data": "JVBER==", "mimeType": "application/pdf"}},
                ],
            },
        ],
    },
}

METADATA_ASSET = {
    "@a/with-meta": {
        "metadata": {"title": "With Metadata", "type": "content"},
        "data": [
            {"role": "$metadata", "parts": [{"text": "meta info"}]},
            {"role": "user", "parts": [{"text": "actual content"}]},
        ],
    },
}


# ---------------------------------------------------------------------------
# _get_last_non_metadata
# ---------------------------------------------------------------------------


class TestGetLastNonMetadata:
    def test_returns_last_non_metadata_item(self):
        data = [
            {"role": "$metadata", "parts": [{"text": "meta"}]},
            {"role": "user", "parts": [{"text": "first"}]},
            {"role": "user", "parts": [{"text": "second"}]},
        ]
        result = _get_last_non_metadata(data)
        assert result is not None
        assert result["parts"][0]["text"] == "second"

    def test_skips_metadata_at_end(self):
        data = [
            {"role": "user", "parts": [{"text": "content"}]},
            {"role": "$metadata", "parts": [{"text": "meta"}]},
        ]
        result = _get_last_non_metadata(data)
        assert result is not None
        assert result["parts"][0]["text"] == "content"

    def test_returns_none_for_all_metadata(self):
        data = [
            {"role": "$metadata", "parts": [{"text": "meta"}]},
        ]
        assert _get_last_non_metadata(data) is None

    def test_returns_none_for_empty_list(self):
        assert _get_last_non_metadata([]) is None


# ---------------------------------------------------------------------------
# _resolve_asset_text
# ---------------------------------------------------------------------------


class TestResolveAssetText:
    def test_text_asset_returns_text(self):
        param = {"type": "asset", "path": "@a/notes", "title": "Notes"}
        result = _resolve_asset_text(param, TEXT_ASSET)
        assert result == "These are my notes."

    def test_image_asset_returns_empty(self):
        """Binary assets have no text — text extraction returns empty."""
        param = {"type": "asset", "path": "@a/photo", "title": "Photo"}
        result = _resolve_asset_text(param, IMAGE_ASSET)
        assert result == ""

    def test_missing_asset_returns_title(self):
        param = {"type": "asset", "path": "@a/missing", "title": "Fallback"}
        result = _resolve_asset_text(param, TEXT_ASSET)
        assert result == "Fallback"

    def test_no_assets_returns_title(self):
        param = {"type": "asset", "path": "@a/notes", "title": "Fallback"}
        result = _resolve_asset_text(param, None)
        assert result == "Fallback"

    def test_metadata_item_skipped(self):
        param = {"type": "asset", "path": "@a/with-meta", "title": "With Metadata"}
        result = _resolve_asset_text(param, METADATA_ASSET)
        assert result == "actual content"


# ---------------------------------------------------------------------------
# _substitute_template — asset handling
# ---------------------------------------------------------------------------


class TestSubstituteTemplateAssets:
    def test_text_asset_substituted(self):
        prompt = 'Summarize: {{"type":"asset","path":"@a/notes","title":"Notes"}}'
        result = _substitute_template(prompt, {}, TEXT_ASSET)
        assert result == "Summarize: These are my notes."

    def test_missing_asset_falls_back_to_title(self):
        prompt = 'About: {{"type":"asset","path":"@a/gone","title":"Missing Doc"}}'
        result = _substitute_template(prompt, {}, TEXT_ASSET)
        assert result == "About: Missing Doc"

    def test_mixed_in_and_asset_placeholders(self):
        prompt = (
            'Topic: {{"type":"in","path":"node-1","title":"Topic"}} '
            'Notes: {{"type":"asset","path":"@a/notes","title":"Notes"}}'
        )
        inputs = {"p-z-node-1": [{"role": "user", "parts": [{"text": "cats"}]}]}
        result = _substitute_template(prompt, inputs, TEXT_ASSET)
        assert result == "Topic: cats Notes: These are my notes."

    def test_image_asset_substituted_as_empty(self):
        """Binary assets contribute no inline text (handled as segments)."""
        prompt = 'Describe: {{"type":"asset","path":"@a/photo","title":"Photo"}}'
        result = _substitute_template(prompt, {}, IMAGE_ASSET)
        assert result == "Describe: "


# ---------------------------------------------------------------------------
# _collect_asset_segments
# ---------------------------------------------------------------------------


class TestCollectAssetSegments:
    def test_image_asset_produces_segment(self):
        config = {
            "config$prompt": {
                "parts": [
                    {"text": 'Describe: {{"type":"asset","path":"@a/photo","title":"Photo"}}'},
                ],
            },
        }
        segments = _collect_asset_segments("", config, IMAGE_ASSET)
        assert len(segments) == 1
        assert segments[0]["type"] == "asset"
        assert segments[0]["title"] == "Photo"
        assert segments[0]["content"]["parts"][0]["inlineData"]["mimeType"] == "image/png"

    def test_text_asset_produces_no_segment(self):
        """Text-only assets are handled by _substitute_template, not segments."""
        config = {
            "config$prompt": {
                "parts": [
                    {"text": 'Read: {{"type":"asset","path":"@a/notes","title":"Notes"}}'},
                ],
            },
        }
        segments = _collect_asset_segments("", config, TEXT_ASSET)
        assert len(segments) == 0

    def test_mixed_asset_produces_segment(self):
        """Assets with both text and binary parts produce a segment."""
        config = {
            "config$prompt": {
                "parts": [
                    {"text": 'Analyze: {{"type":"asset","path":"@a/doc","title":"Document"}}'},
                ],
            },
        }
        segments = _collect_asset_segments("", config, MIXED_ASSET)
        assert len(segments) == 1
        assert segments[0]["title"] == "Document"

    def test_no_assets_produces_empty(self):
        config = {
            "config$prompt": {
                "parts": [
                    {"text": 'Read: {{"type":"asset","path":"@a/notes","title":"Notes"}}'},
                ],
            },
        }
        segments = _collect_asset_segments("", config, None)
        assert len(segments) == 0


# ---------------------------------------------------------------------------
# _build_segments_from_inputs — with assets
# ---------------------------------------------------------------------------


class TestBuildSegmentsWithAssets:
    def test_text_asset_in_prompt_substituted(self):
        """Text assets are substituted inline in the prompt segment."""
        config = {
            "config$prompt": {
                "parts": [
                    {"text": 'Summarize: {{"type":"asset","path":"@a/notes","title":"Notes"}}'},
                ],
            },
        }
        segments = _build_segments_from_inputs({}, config, TEXT_ASSET)
        # Should have a text segment with the substituted prompt
        # (plus the default system instruction segment).
        text_segments = [s for s in segments if s["type"] == "text"]
        prompt_segments = [s for s in text_segments if "my notes" in s["text"]]
        assert len(prompt_segments) == 1
        assert "These are my notes." in prompt_segments[0]["text"]

    def test_image_asset_produces_extra_segment(self):
        """Image assets produce both a text segment (empty sub) and an asset segment."""
        config = {
            "config$prompt": {
                "parts": [
                    {"text": 'Describe: {{"type":"asset","path":"@a/photo","title":"Photo"}}'},
                ],
            },
        }
        segments = _build_segments_from_inputs({}, config, IMAGE_ASSET)
        # Prompt text segment + default SI segment.
        text_segments = [s for s in segments if s["type"] == "text"]
        prompt_segments = [s for s in text_segments if "Describe" in s["text"]]
        assert len(prompt_segments) == 1
        asset_segments = [s for s in segments if s["type"] == "asset"]
        assert len(asset_segments) == 1
        assert asset_segments[0]["title"] == "Photo"


# ---------------------------------------------------------------------------
# Integration: GraphDescriptor → GraphPlan assets threading
# ---------------------------------------------------------------------------


class TestAssetsThreading:
    def test_graph_descriptor_from_dict_preserves_assets(self):
        """Assets from BGL JSON are preserved in GraphDescriptor."""
        from opal_backend.graph_types import GraphDescriptor

        d = {
            "nodes": [{"id": "n1", "type": "generate"}],
            "edges": [],
            "assets": {
                "@a/notes": {
                    "metadata": {"title": "Notes", "type": "content"},
                    "data": [{"role": "user", "parts": [{"text": "hello"}]}],
                },
            },
        }
        graph = GraphDescriptor.from_dict(d)
        assert graph.assets is not None
        assert "@a/notes" in graph.assets
        assert graph.assets["@a/notes"]["data"][0]["parts"][0]["text"] == "hello"

    def test_graph_descriptor_to_dict_includes_assets(self):
        """Assets survive round-trip through to_dict."""
        from opal_backend.graph_types import GraphDescriptor

        assets = {"@a/x": {"data": [{"parts": [{"text": "y"}]}]}}
        graph = GraphDescriptor(nodes=[], edges=[], assets=assets)
        d = graph.to_dict()
        assert d["assets"] == assets

    def test_graph_plan_carries_assets(self):
        """create_plan passes assets from GraphDescriptor into GraphPlan."""
        from opal_backend.graph_condense import condense
        from opal_backend.graph_plan import create_plan
        from opal_backend.graph_types import GraphDescriptor

        d = {
            "nodes": [
                {"id": "gen", "type": "generate"},
                {"id": "out", "type": "output"},
            ],
            "edges": [
                {"from": "gen", "to": "out", "out": "context", "in": "result"},
            ],
            "assets": TEXT_ASSET,
        }
        graph = GraphDescriptor.from_dict(d)
        condensed = condense(graph)
        plan = create_plan(condensed)
        assert plan.assets == TEXT_ASSET
