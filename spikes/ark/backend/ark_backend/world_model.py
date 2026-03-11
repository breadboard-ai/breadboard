# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""World Model — the agent's persistent internal state.

The world model is the source of truth for what the agent knows: active
journeys, accumulated user context, and background tasks. It's persisted
to disk as JSON so a server restart doesn't erase the agent's memory.
"""

import json
import logging
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# Persistence directory — sibling of out/.
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


@dataclass
class JourneyStep:
    """One state in a journey's state machine."""

    id: str
    label: str  # Consumer-language, e.g. "Understanding your requirements"
    needs_user: bool = True
    view_files: list[str] = field(default_factory=list)  # Pre-produced artifacts
    auto_delay_seconds: float = 0  # Simulated processing time for non-user steps


@dataclass
class Journey:
    """A multi-step journey the agent is guiding the user through."""

    id: str
    objective: str
    steps: list[JourneyStep] = field(default_factory=list)
    current_step_index: int = 0
    context: dict = field(default_factory=dict)  # Accumulated data across steps
    status: str = "active"  # planning | generating | active | processing | complete | error
    current_detail: str = ""  # Real-time progress from the agent
    error_message: str = ""  # Populated when status == "error"

    @property
    def current_step(self) -> JourneyStep | None:
        if 0 <= self.current_step_index < len(self.steps):
            return self.steps[self.current_step_index]
        return None

    @property
    def is_complete(self) -> bool:
        return self.status == "complete"

    @property
    def progress(self) -> dict:
        if self.status == "error":
            label = self.error_message or "Something went wrong"
        elif self.status in ("planning", "generating"):
            label = self.current_detail or (
                "Planning your journey…" if self.status == "planning"
                else "Generating views…"
            )
        elif self.current_step:
            label = self.current_step.label
        else:
            label = "Complete"
        return {
            "current": min(self.current_step_index, len(self.steps)),
            "total": len(self.steps),
            "label": label,
        }


@dataclass
class WorldModel:
    """The agent's internal world — all journeys and accumulated knowledge."""

    journeys: dict[str, Journey] = field(default_factory=dict)

    def create_journey(self, objective: str, steps: list[JourneyStep]) -> Journey:
        """Create a new journey and persist."""
        journey_id = uuid.uuid4().hex[:12]
        journey = Journey(id=journey_id, objective=objective, steps=steps)
        self.journeys[journey_id] = journey
        self.save()
        return journey

    def get_journey(self, journey_id: str) -> Journey | None:
        return self.journeys.get(journey_id)

    def save(self) -> None:
        """Persist to disk."""
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        path = DATA_DIR / "world.json"
        data = {
            "journeys": {
                jid: _journey_to_dict(j) for jid, j in self.journeys.items()
            },
        }
        path.write_text(json.dumps(data, indent=2))
        logger.debug("World model saved to %s", path)

    @classmethod
    def load(cls) -> "WorldModel":
        """Load from disk, or return empty if no saved state."""
        path = DATA_DIR / "world.json"
        if not path.is_file():
            logger.info("No saved world model, starting fresh")
            return cls()

        try:
            data = json.loads(path.read_text())
            model = cls()
            for jid, jdata in data.get("journeys", {}).items():
                model.journeys[jid] = _journey_from_dict(jdata)
            logger.info("Loaded world model with %d journeys", len(model.journeys))
            return model
        except Exception:
            logger.exception("Failed to load world model, starting fresh")
            return cls()


def _journey_to_dict(j: Journey) -> dict:
    """Serialize a Journey to a JSON-safe dict."""
    return {
        "id": j.id,
        "objective": j.objective,
        "steps": [asdict(s) for s in j.steps],
        "current_step_index": j.current_step_index,
        "context": j.context,
        "status": j.status,
    }


def _journey_from_dict(d: dict) -> Journey:
    """Deserialize a Journey from a dict."""
    steps = [
        JourneyStep(
            id=s["id"],
            label=s["label"],
            needs_user=s.get("needs_user", True),
            view_files=s.get("view_files", []),
            auto_delay_seconds=s.get("auto_delay_seconds", 0),
        )
        for s in d.get("steps", [])
    ]
    return Journey(
        id=d["id"],
        objective=d["objective"],
        steps=steps,
        current_step_index=d.get("current_step_index", 0),
        context=d.get("context", {}),
        status=d.get("status", "active"),
    )
