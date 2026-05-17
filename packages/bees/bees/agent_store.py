# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Agent store — CRUD for agent directories.

Manages ``agents/{uuid}/`` directories, each containing a
``metadata.json`` file with the agent's configuration and status.

Designed to mirror the SQL-first entity model from Project Swarm:
each directory is a row in the ``agents`` table.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bees.agent import Agent, AgentMetadata, AgentStatus, RunnerType


class AgentStore:
    """Encapsulates agent CRUD operations on ``agents/{uuid}/`` directories."""

    def __init__(self, hive_dir: Path):
        self.hive_dir = hive_dir
        self.agents_dir = hive_dir / "agents"

    def create(
        self,
        *,
        type: str,
        slug: str,
        finite: bool = True,
        runner: RunnerType = "generate",
        parent_id: str | None = None,
        workspace_root_id: str | None = None,
        model: str | None = None,
        voice: str | None = None,
        functions: list[str] | None = None,
        skills: list[str] | None = None,
        options: dict[str, Any] | None = None,
        watch_events: list[dict[str, Any]] | None = None,
        signal_type: str | None = None,
        playbook_id: str | None = None,
        tasks: list[str] | None = None,
        tags: list[str] | None = None,
    ) -> Agent:
        """Create a new agent directory with metadata.

        Returns the created Agent.
        """
        agent_id = str(uuid.uuid4())
        agent_dir = self.agents_dir / agent_id
        agent_dir.mkdir(parents=True, exist_ok=True)

        # Root agents own their own workspace.
        if workspace_root_id is None and parent_id is None:
            workspace_root_id = agent_id

        metadata = AgentMetadata(
            type=type,
            slug=slug,
            status="available",
            finite=finite,
            runner=runner,
            parent_id=parent_id,
            workspace_root_id=workspace_root_id,
            model=model,
            voice=voice,
            functions=functions,
            skills=skills,
            options=options,
            watch_events=watch_events,
            signal_type=signal_type,
            playbook_id=playbook_id,
            tasks=tasks,
            tags=tags,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

        agent = Agent(id=agent_id, dir=agent_dir, metadata=metadata)
        self._write_metadata(agent)
        return agent

    def get(self, agent_id: str) -> Agent | None:
        """Load an agent by ID. Returns None if not found or malformed."""
        agent_dir = self.agents_dir / agent_id
        if not agent_dir.exists():
            return None

        metadata_path = agent_dir / "metadata.json"
        if not metadata_path.exists():
            return None

        try:
            mdata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            return None

        metadata = AgentMetadata.from_dict(mdata)

        # Load objective from disk — stored separately from metadata.
        objective = ""
        objective_path = agent_dir / "objective.md"
        if objective_path.exists():
            objective = objective_path.read_text(encoding="utf-8")

        return Agent(
            id=agent_id,
            dir=agent_dir,
            metadata=metadata,
            objective=objective,
        )

    def query_all(self, status: AgentStatus | None = None) -> list[Agent]:
        """List agents, optionally filtered by status."""
        if not self.agents_dir.exists():
            return []

        agents: list[Agent] = []
        for agent_dir in sorted(self.agents_dir.iterdir()):
            if not agent_dir.is_dir():
                continue
            agent = self.get(agent_dir.name)
            if agent is None:
                continue
            if status is not None and agent.metadata.status != status:
                continue
            agents.append(agent)

        agents.sort(key=lambda a: a.metadata.created_at or "", reverse=True)
        return agents

    def get_children(self, parent_id: str | None = None) -> list[Agent]:
        """Returns children of the given agent, or roots if parent_id is None."""
        if parent_id is None:
            return [a for a in self.query_all() if not a.metadata.parent_id]
        return [a for a in self.query_all() if a.metadata.parent_id == parent_id]

    def save_metadata(self, agent: Agent) -> None:
        """Persist only the metadata."""
        self._write_metadata(agent)

    def _write_metadata(self, agent: Agent) -> None:
        """Write metadata.json to the agent's directory."""
        agent.dir.mkdir(parents=True, exist_ok=True)
        (agent.dir / "metadata.json").write_text(
            json.dumps(agent.metadata.to_dict(), indent=2, ensure_ascii=False)
            + "\n"
        )
