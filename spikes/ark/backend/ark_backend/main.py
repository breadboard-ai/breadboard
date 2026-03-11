"""Ark backend — FastAPI spike server."""

import asyncio
import json
import logging
import mimetypes
import os
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ark_backend.artifacts import generate_artifacts
from ark_backend.world_model import WorldModel
import ark_backend.journey_router as journey_router

load_dotenv()

logger = logging.getLogger(__name__)

# Gemini API key — when set, the skilled agent runs for real.
# When absent, falls back to simulation.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

app = FastAPI(title="Ark Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve the out/ directory relative to the project root (one level above
# the ark_backend package).
OUT_DIR = Path(__file__).resolve().parent.parent.parent / "out"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Serve generated artifacts as static files.
app.mount("/out", StaticFiles(directory=str(OUT_DIR)), name="out")

# Load the world model from disk (survives restarts).
world = WorldModel.load()

# ---------------------------------------------------------------------------
# Echo
# ---------------------------------------------------------------------------


class EchoRequest(BaseModel):
    message: str


class EchoResponse(BaseModel):
    echo: str


@app.post("/echo")
async def echo(request: EchoRequest) -> EchoResponse:
    """Echo the incoming message back."""
    return EchoResponse(echo=request.message)


# ---------------------------------------------------------------------------
# Agent runs
# ---------------------------------------------------------------------------

# Simulated generation steps — each is (delay_seconds, event_data).
_SIMULATION_STEPS = [
    (0.5,  {"step": "thinking",    "detail": "Analyzing objective…"}),
    (1.5,  {"step": "planning",    "detail": "Breaking down into components…"}),
    (1.0,  {"step": "scaffolding", "detail": "Generating HTML skeleton…"}),
    (3.0,  {"step": "component",   "detail": "Building header component…",    "code": "<header>…</header>"}),
    (2.5,  {"step": "component",   "detail": "Building main content area…",   "code": "<main>…</main>"}),
    (3.0,  {"step": "component",   "detail": "Building sidebar navigation…",  "code": "<nav>…</nav>"}),
    (2.5,  {"step": "styling",     "detail": "Applying design tokens…"}),
    (2.0,  {"step": "styling",     "detail": "Adding responsive breakpoints…"}),
    (2.0,  {"step": "refinement",  "detail": "Polishing interactions…"}),
    (1.5,  {"step": "refinement",  "detail": "Accessibility pass…"}),
    (0.5,  {"step": "complete",    "detail": "UI generation finished."}),
]


@dataclass
class Run:
    id: str
    objective: str
    agent_type: str
    status: str = "running"  # "running" | "complete"
    current_step: str = "starting"
    current_detail: str = "Initializing…"
    progress: int = 0  # 0..total steps
    total_steps: int = len(_SIMULATION_STEPS)
    events: list[dict] = field(default_factory=list)
    artifacts: list[str] = field(default_factory=list)
    # Subscribers waiting for new events (live SSE connections).
    subscribers: list[asyncio.Queue] = field(default_factory=list)


# In-memory run store (spike-grade).
runs: dict[str, Run] = {}


def _hydrate_from_disk():
    """Populate runs from existing artifacts in OUT_DIR (survives restarts)."""
    if not OUT_DIR.is_dir():
        return
    for run_dir in OUT_DIR.iterdir():
        if not run_dir.is_dir():
            continue
        run_id = run_dir.name
        # Skip the shared library directory — it's not a run.
        if run_id.startswith("_"):
            continue
        if run_id in runs:
            continue

        # Recover objective: objective.txt > SKILL.md heading > run_id.
        obj_path = run_dir / "objective.txt"
        skill_path = run_dir / "SKILL.md"
        objective = run_id  # fallback
        if obj_path.is_file():
            objective = obj_path.read_text().strip()
        elif skill_path.is_file():
            first_line = skill_path.read_text().split("\n", 1)[0]
            if first_line.startswith("# Generated UI: "):
                objective = first_line.removeprefix("# Generated UI: ")

        # Collect all files relative to the run dir.
        # .ref files represent library-promoted components — map them back
        # to their original artifact name so _stream_bundle can resolve them.
        artifacts: list[str] = []
        for p in sorted(run_dir.rglob("*")):
            if not p.is_file():
                continue
            rel = str(p.relative_to(run_dir))
            # Skip non-artifact files.
            if rel == "objective.txt" or rel.startswith("references/"):
                continue
            if rel.endswith(".ref"):
                # components/PieChart.jsx.ref → components/PieChart.jsx
                artifacts.append(rel.removesuffix(".ref"))
            else:
                artifacts.append(rel)

        runs[run_id] = Run(
            id=run_id,
            objective=objective,
            agent_type="ui",
            status="complete",
            current_step="complete",
            current_detail="UI generation finished.",
            progress=len(_SIMULATION_STEPS),
            artifacts=artifacts,
        )


_hydrate_from_disk()


class StartRunRequest(BaseModel):
    objective: str
    type: str = "ui"


class StartRunResponse(BaseModel):
    id: str


LIBRARY_DIR = OUT_DIR / "_library"


def _promote_to_library(run_id: str, artifacts: list[str]) -> None:
    """Promote sub-components to the shared library.

    - Copies sub-component files (not App.jsx) to _library/.
    - Replaces the run-local file with a .ref pointer.
    - Both the original run and future runs resolve via _stream_bundle.
    """
    import shutil

    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    run_dir = OUT_DIR / run_id

    for artifact in artifacts:
        # Only promote sub-components, not App.jsx or CSS.
        if artifact == "App.jsx" or not artifact.endswith(".jsx"):
            continue

        source = run_dir / artifact
        if not source.is_file():
            continue

        # Library key is just the basename: PieChart.jsx, Header.jsx, etc.
        lib_name = Path(artifact).name
        lib_dest = LIBRARY_DIR / lib_name

        # Copy to library if not already there (first writer wins).
        if not lib_dest.is_file():
            shutil.copy2(source, lib_dest)
            logger.info("Promoted %s to library as %s", artifact, lib_name)

        # Replace original with a .ref pointer.
        source.unlink()
        ref_path = run_dir / (artifact + ".ref")
        ref_path.parent.mkdir(parents=True, exist_ok=True)
        ref_path.write_text(lib_name)


def _resolve_library_imports(run_id: str, artifacts: list[str]) -> None:
    """Scan App.jsx for component imports and create .ref files for any
    that are missing locally but exist in the library.

    This handles the case where the agent imported a library component
    but didn't save it — the bundle endpoint resolves via .ref.
    """
    import re

    run_dir = OUT_DIR / run_id
    app_path = run_dir / "App.jsx"
    if not app_path.is_file():
        return

    source = app_path.read_text()
    # Match: import Foo from "./components/Foo"
    imports = re.findall(
        r'import\s+\w+\s+from\s+["\']\./(components/\w+)["\']', source
    )

    for imp in imports:
        rel_path = imp + ".jsx"  # components/PieChart -> components/PieChart.jsx
        local_file = run_dir / rel_path
        ref_file = run_dir / (rel_path + ".ref")
        lib_name = Path(rel_path).name  # PieChart.jsx

        if local_file.is_file() or ref_file.is_file():
            continue  # Already resolved.

        lib_path = LIBRARY_DIR / lib_name
        if lib_path.is_file():
            # Create a .ref pointer.
            ref_file.parent.mkdir(parents=True, exist_ok=True)
            ref_file.write_text(lib_name)
            # Add to artifacts so the bundle endpoint includes it.
            if rel_path not in artifacts:
                artifacts.append(rel_path)
            logger.info("Resolved %s from library for run %s", lib_name, run_id)


def _promote_skill_output(run_id: str, artifacts: list[str]) -> None:
    """Auto-install skills produced by the agent.

    Scans all .md files in the run output for skill front matter (YAML
    with a ``name`` field). Each detected skill is installed to
    skills/{slug}/SKILL.md.
    """
    from opal_backend.skilled_agent import parse_skill_front_matter

    run_dir = OUT_DIR / run_id
    md_files = [a for a in artifacts if a.endswith(".md")]
    if not md_files:
        return

    for md_file in md_files:
        # Skip reference material and other non-skill files.
        if md_file.startswith("references/"):
            continue

        skill_path = run_dir / md_file
        if not skill_path.is_file():
            continue

        content = skill_path.read_text()

        # Quick check: must have YAML front matter delimiters.
        if not content.startswith("---"):
            continue

        name, _description = parse_skill_front_matter(content)
        if not name or name == "Untitled" or name == md_file:
            continue

        # Derive slug: "Recipe Generation" -> "recipe-generation"
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        if not slug:
            continue

        dest_dir = SKILLS_DIR / slug
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / "SKILL.md"
        dest.write_text(content)
        logger.info("Auto-installed skill '%s' as %s", name, slug)


async def _simulate_run(run: Run):
    """Background task that walks through simulation steps."""
    for i, (delay, data) in enumerate(_SIMULATION_STEPS):
        await asyncio.sleep(delay)
        run.current_step = data["step"]
        run.current_detail = data["detail"]
        run.progress = i + 1

        event = {"type": "progress", **data}
        run.events.append(event)
        for q in run.subscribers:
            await q.put(event)

    # Generate artifacts on completion.
    files = generate_artifacts(run.id, run.objective, OUT_DIR)
    run.artifacts = files

    # Promote sub-components to the shared library.
    _promote_to_library(run.id, files)

    run.status = "complete"
    done_event = {"type": "done", "id": run.id, "artifacts": files}
    run.events.append(done_event)
    for q in run.subscribers:
        await q.put(done_event)


@app.post("/agent/runs/start")
async def start_run(request: StartRunRequest) -> StartRunResponse:
    """Create a new agent run and return its ID."""
    if request.type not in ("ui", "bash"):
        raise HTTPException(status_code=400, detail=f"Unknown agent type: {request.type}")

    if request.type == "bash" and not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY required for bash agent",
        )

    run_id = uuid.uuid4().hex[:12]
    run = Run(id=run_id, objective=request.objective, agent_type=request.type)
    runs[run_id] = run

    # Persist objective so it survives server restarts.
    run_dir = OUT_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "objective.txt").write_text(request.objective)

    if request.type == "bash":
        asyncio.create_task(_run_bash_agent(run))
    elif GEMINI_API_KEY:
        asyncio.create_task(_run_with_skilled_agent(run))
    else:
        asyncio.create_task(_simulate_run(run))
    return StartRunResponse(id=run_id)

async def _run_bash_agent(run: Run):
    """Run the bash sandbox agent — no skills, just shell access."""
    from ark_backend.gemini_client import ApiKeyBackendClient
    from ark_backend.sandbox import get_sandbox_function_group
    from opal_backend.skilled_agent import run_skilled_agent, Skill

    backend = ApiKeyBackendClient(api_key=GEMINI_API_KEY)

    # Create a persistent working directory for this run.
    sandbox_dir = OUT_DIR / run.id / "sandbox"
    sandbox_dir.mkdir(parents=True, exist_ok=True)
    sandbox_group = get_sandbox_function_group(work_dir=sandbox_dir)

    # Minimal "skill" that just tells the agent to use bash.
    bash_skill = Skill(
        name="Bash Runner",
        description="Accomplish objectives using shell commands.",
        content=(
            "---\n"
            "name: Bash Runner\n"
            "description: Accomplish objectives using shell commands.\n"
            "---\n\n"
            "# Bash Runner\n\n"
            "You have access to `execute_bash` to run shell commands.\n"
            "Your working directory is `$HOME`. Use it to accomplish\n"
            "the user's objective. Install tools as needed.\n"
        ),
    )

    try:
        last_detail = None

        async for event in run_skilled_agent(
            objective=run.objective,
            skills=[bash_skill],
            backend=backend,
            extra_groups=[sandbox_group],
        ):
            etype = getattr(event, "type", "unknown")
            emit = False

            if etype == "thought":
                text = getattr(event, "text", "")[:200]
                if text:
                    run.current_step = "thinking"
                    run.current_detail = text
                    emit = True
            elif etype == "functionCall":
                name = getattr(event, "name", "")
                args = getattr(event, "args", {})
                run.current_step = "working"
                if name == "execute_bash":
                    cmd = args.get("command", "")
                    preview = cmd[:120] + ("…" if len(cmd) > 120 else "")
                    run.current_detail = f"$ {preview}"
                else:
                    run.current_detail = f"Calling {name}…"
                run.progress += 1
                emit = True
            elif etype == "functionResult":
                # The Loop wraps handler results as:
                # content = {"parts": [{"functionResponse": {
                #     "name": "execute_bash",
                #     "response": {"stdout": "...", "exit_code": 0}
                # }}]}
                content = getattr(event, "content", {})
                parts = content.get("parts", []) if isinstance(content, dict) else []
                if parts:
                    fr = parts[0].get("functionResponse", {})
                    result_data = fr.get("response", {})
                    stdout = result_data.get("stdout", "")
                    exit_code = result_data.get("exit_code")
                    error = result_data.get("error")
                    if error:
                        run.current_step = "result"
                        run.current_detail = f"Error: {error}"
                        emit = True
                    elif stdout:
                        # Truncate for display.
                        preview = stdout[:500]
                        if len(stdout) > 500:
                            preview += "\n…"
                        suffix = f" (exit {exit_code})" if exit_code else ""
                        run.current_step = "result"
                        run.current_detail = f"{preview}{suffix}"
                        emit = True
            elif etype == "complete":
                result = getattr(event, "result", None)
                if result:
                    # Extract the agent's outcome text.
                    outcomes = getattr(result, "outcomes", None)
                    if outcomes and isinstance(outcomes, dict):
                        parts = outcomes.get("parts", [])
                        for p in parts:
                            text = p.get("text", "")
                            if text:
                                run.outcome = text

                    # Save any intermediate files.
                    if getattr(result, "intermediate", None):
                        run_dir = OUT_DIR / run.id
                        run_dir.mkdir(parents=True, exist_ok=True)
                        for file_data in result.intermediate:
                            dest = run_dir / file_data.path.lstrip("/")
                            dest.parent.mkdir(parents=True, exist_ok=True)
                            content = file_data.content
                            fparts = content.get("parts", []) if isinstance(content, dict) else []
                            text = fparts[0].get("text", "") if fparts else ""
                            if text:
                                dest.write_text(text)
                            else:
                                dest.write_text(str(content))
                            run.artifacts.append(
                                str(dest.relative_to(run_dir))
                            )

            # Only emit when there's a real state change.
            if emit and run.current_detail != last_detail:
                last_detail = run.current_detail
                progress_event = {
                    "type": "progress",
                    "step": run.current_step,
                    "detail": run.current_detail,
                }
                run.events.append(progress_event)
                for q in run.subscribers:
                    await q.put(progress_event)

    except Exception as e:
        logger.exception("Bash agent failed")
        error_event = {"type": "progress", "step": "error", "detail": str(e)}
        run.events.append(error_event)
        for q in run.subscribers:
            await q.put(error_event)

    run.status = "complete"
    done_event = {
        "type": "done",
        "id": run.id,
        "artifacts": run.artifacts,
        "outcome": getattr(run, "outcome", None),
    }
    run.events.append(done_event)
    for q in run.subscribers:
        await q.put(done_event)


async def _run_with_skilled_agent(run: Run):
    """Run the real skilled agent loop."""
    from ark_backend.gemini_client import ApiKeyBackendClient
    from ark_backend.sandbox import get_sandbox_function_group
    from opal_backend.skilled_agent import (
        Skill, parse_skill_front_matter, run_skilled_agent,
    )

    # Discover skills from backend/skills/*/SKILL.md.
    skills_dir = Path(__file__).resolve().parent.parent / "skills"
    skills: list[Skill] = []
    if skills_dir.is_dir():
        for skill_path in sorted(skills_dir.glob("*/SKILL.md")):
            content = skill_path.read_text()
            name, description = parse_skill_front_matter(content)
            skills.append(Skill(
                name=name, description=description, content=content,
            ))
            logger.info("Loaded skill: %s (%s)", name, skill_path.parent.name)

    if not skills:
        logger.warning("No skills found in %s, falling back to simulation", skills_dir)
        await _simulate_run(run)
        return

    backend = ApiKeyBackendClient(api_key=GEMINI_API_KEY)

    # Pre-load previous runs' components into the agent's file system.
    pre_loaded: dict[str, str] = {}
    for other_id, other_run in runs.items():
        if other_id == run.id or other_run.status != "complete":
            continue
        other_dir = OUT_DIR / other_id
        if not other_dir.is_dir():
            continue
        for artifact in other_run.artifacts:
            if artifact.endswith((".jsx", ".css")):
                artifact_path = other_dir / artifact
                if artifact_path.is_file():
                    key = f"library/{other_id}/{artifact}"
                    pre_loaded[key] = artifact_path.read_text()

    # Pre-load reference material from backend/references/.
    refs_dir = Path(__file__).resolve().parent.parent / "references"
    if refs_dir.is_dir():
        for ref_file in sorted(refs_dir.rglob("*.md")):
            # Skip _staging directories (unpublished references).
            if "/_staging/" in str(ref_file) or ref_file.parent.name == "_staging":
                continue
            key = f"references/{ref_file.relative_to(refs_dir)}"
            pre_loaded[key] = ref_file.read_text()
            logger.info("Pre-loaded reference: %s", key)

    if pre_loaded:
        logger.info("Pre-loaded %d files total", len(pre_loaded))

    # Create a persistent working directory for this run's bash sandbox.
    sandbox_dir = OUT_DIR / run.id / "sandbox"
    sandbox_dir.mkdir(parents=True, exist_ok=True)
    sandbox_group = get_sandbox_function_group(work_dir=sandbox_dir)

    try:
        async for event in run_skilled_agent(
            objective=run.objective,
            skills=skills,
            backend=backend,
            pre_loaded_files=pre_loaded if pre_loaded else None,
            extra_groups=[sandbox_group],
        ):
            etype = getattr(event, "type", "unknown")

            # Map agent events to run progress.
            if etype == "start":
                run.current_step = "thinking"
                run.current_detail = "Agent started…"
            elif etype == "thought":
                run.current_step = "thinking"
                run.current_detail = getattr(event, "text", "")[:100]
            elif etype == "functionCall":
                name = getattr(event, "name", "")
                run.current_step = "working"
                run.current_detail = f"Calling {name}…"
                run.progress += 1
            elif etype == "functionCallUpdate":
                status = getattr(event, "status", "")
                if status:
                    run.current_detail = status[:100]
            elif etype == "complete":
                result = getattr(event, "result", None)
                if result and getattr(result, "intermediate", None):
                    # Write agent-produced files to disk.
                    run_dir = OUT_DIR / run.id
                    run_dir.mkdir(parents=True, exist_ok=True)
                    for file_data in result.intermediate:
                        dest = run_dir / file_data.path.lstrip("/")
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        content = file_data.content
                        # content is LLMContent: {"parts": [{"text": "..."}]}
                        parts = content.get("parts", []) if isinstance(content, dict) else []
                        text = parts[0].get("text", "") if parts else ""
                        if text:
                            dest.write_text(text)
                        else:
                            dest.write_text(str(content))
                        run.artifacts.append(
                            str(dest.relative_to(run_dir))
                        )

            # Broadcast progress event.
            progress_event = {
                "type": "progress",
                "step": run.current_step,
                "detail": run.current_detail,
            }
            run.events.append(progress_event)
            for q in run.subscribers:
                await q.put(progress_event)

    except Exception as e:
        logger.exception("Skilled agent failed, falling back to simulation")
        await _simulate_run(run)
        return

    # Promote sub-components to the shared library.
    _promote_to_library(run.id, run.artifacts)
    # Also resolve any imports the agent used but didn't save.
    _resolve_library_imports(run.id, run.artifacts)
    # Auto-install any SKILL.md the agent produced (Teacher workflow).
    _promote_skill_output(run.id, run.artifacts)

    run.status = "complete"
    done_event = {"type": "done", "id": run.id, "artifacts": run.artifacts}
    run.events.append(done_event)
    for q in run.subscribers:
        await q.put(done_event)


@app.get("/agent/runs/status")
async def list_runs():
    """Return current status of all runs (for polling)."""
    return [
        {
            "id": r.id,
            "objective": r.objective,
            "status": r.status,
            "current_step": r.current_step,
            "current_detail": r.current_detail,
            "progress": r.progress,
            "total_steps": r.total_steps,
            "artifacts": r.artifacts,
        }
        for r in runs.values()
    ]


@app.delete("/agent/runs/{run_id}")
async def delete_run(run_id: str):
    """Delete a run and its artifacts from disk."""
    import shutil

    run = runs.pop(run_id, None)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    # Remove artifacts from disk.
    run_dir = OUT_DIR / run_id
    if run_dir.is_dir():
        shutil.rmtree(run_dir)

    # Clean up orphaned library files.
    _gc_library()

    return {"deleted": run_id}


def _gc_library() -> None:
    """Remove library files that no remaining run references.

    Scans all run directories for .ref files and deletes any library
    entry not referenced by at least one run.
    """
    if not LIBRARY_DIR.is_dir():
        return

    library_files = {f.name for f in LIBRARY_DIR.iterdir() if f.is_file()}
    if not library_files:
        return

    # Collect all referenced library filenames from .ref files.
    referenced: set[str] = set()
    for run_dir in OUT_DIR.iterdir():
        if not run_dir.is_dir() or run_dir.name.startswith("_"):
            continue
        for ref_file in run_dir.rglob("*.ref"):
            referenced.add(ref_file.read_text().strip())

    # Delete orphans.
    orphans = library_files - referenced
    for orphan in orphans:
        (LIBRARY_DIR / orphan).unlink(missing_ok=True)
        logger.info("Removed orphaned library file: %s", orphan)

    if orphans:
        logger.info("Library GC: removed %d orphan(s)", len(orphans))


# ─── Skill Management ─────────────────────────────────────────────────────────

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"


@app.get("/skills")
async def list_skills():
    """List all available skills with metadata."""
    from opal_backend.skilled_agent import parse_skill_front_matter

    result = []
    if not SKILLS_DIR.is_dir():
        return result

    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        skill_path = skill_dir / "SKILL.md"
        if not skill_path.is_file():
            continue
        content = skill_path.read_text()
        name, description = parse_skill_front_matter(content)
        result.append({
            "slug": skill_dir.name,
            "name": name,
            "description": description,
        })
    return result


@app.get("/skills/{slug}")
async def get_skill(slug: str):
    """Return the full content of a skill, with knowledge audit."""
    import hashlib
    import yaml

    skill_path = SKILLS_DIR / slug / "SKILL.md"
    if not skill_path.is_file():
        raise HTTPException(status_code=404, detail="Skill not found")
    content = skill_path.read_text()
    from opal_backend.skilled_agent import parse_skill_front_matter
    name, description = parse_skill_front_matter(content)

    # Parse knowledge_sources from front matter.
    audit = {"status": "unknown", "sources": []}
    fm_match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if fm_match:
        try:
            fm = yaml.safe_load(fm_match.group(1)) or {}
        except Exception:
            fm = {}
        declared = fm.get("knowledge_sources", [])
        if declared:
            refs_dir = Path(__file__).resolve().parent.parent / "references"
            tracked_domains: set[str] = set()
            all_current = True
            sources = []

            for src in declared:
                src_path = refs_dir / src["path"]
                tracked_domains.add(src["path"].split("/")[0])
                if src_path.is_file():
                    current_hash = hashlib.sha256(
                        src_path.read_bytes()
                    ).hexdigest()[:12]
                    matches = current_hash == src.get("hash", "")
                    if not matches:
                        all_current = False
                    sources.append({
                        "path": src["path"],
                        "declared_hash": src.get("hash"),
                        "current_hash": current_hash,
                        "status": "current" if matches else "changed",
                    })
                else:
                    all_current = False
                    sources.append({
                        "path": src["path"],
                        "status": "missing",
                    })

            # Check for NEW references the skill doesn't know about.
            for domain in tracked_domains:
                domain_dir = refs_dir / domain
                if not domain_dir.is_dir():
                    continue
                for ref_file in sorted(domain_dir.rglob("*.md")):
                    if ref_file.parent.name == "_staging":
                        continue
                    rel = str(ref_file.relative_to(refs_dir))
                    known_paths = {s["path"] for s in declared}
                    if rel not in known_paths:
                        all_current = False
                        current_hash = hashlib.sha256(
                            ref_file.read_bytes()
                        ).hexdigest()[:12]
                        sources.append({
                            "path": rel,
                            "current_hash": current_hash,
                            "status": "new_untracked",
                        })

            audit = {
                "status": "current" if all_current else "stale",
                "sources": sources,
            }

    return {
        "slug": slug,
        "name": name,
        "description": description,
        "content": content,
        "knowledge_audit": audit,
    }


@app.delete("/skills/{slug}")
async def delete_skill(slug: str):
    """Delete a skill directory."""
    import shutil

    skill_dir = SKILLS_DIR / slug
    if not skill_dir.is_dir():
        raise HTTPException(status_code=404, detail="Skill not found")
    shutil.rmtree(skill_dir)
    return {"deleted": slug}


@app.post("/skills/{slug}/refresh")
async def refresh_skill(slug: str):
    """Trigger CPD: re-read references and update the skill via Teacher.

    This runs the Teacher skill with all current references, producing
    an updated SKILL.md that reflects the latest knowledge.
    """
    import hashlib

    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="No API key configured")

    skill_path = SKILLS_DIR / slug / "SKILL.md"
    if not skill_path.is_file():
        raise HTTPException(status_code=404, detail="Skill not found")

    # Load the Teacher skill.
    from ark_backend.gemini_client import ApiKeyBackendClient
    from opal_backend.skilled_agent import (
        Skill, parse_skill_front_matter, run_skilled_agent,
    )

    teacher_path = SKILLS_DIR / "teacher" / "SKILL.md"
    if not teacher_path.is_file():
        raise HTTPException(status_code=500, detail="Teacher skill not found")

    teacher_content = teacher_path.read_text()
    t_name, t_desc = parse_skill_front_matter(teacher_content)
    teacher_skill = Skill(name=t_name, description=t_desc, content=teacher_content)

    # Pre-load all current references (excluding _staging).
    refs_dir = Path(__file__).resolve().parent.parent / "references"
    pre_loaded: dict[str, str] = {}
    if refs_dir.is_dir():
        for ref_file in sorted(refs_dir.rglob("*.md")):
            if ref_file.parent.name == "_staging":
                continue
            key = f"references/{ref_file.relative_to(refs_dir)}"
            pre_loaded[key] = ref_file.read_text()

    # Also pre-load the current skill so the Teacher can see what to update.
    current_content = skill_path.read_text()
    current_name, _ = parse_skill_front_matter(current_content)
    pre_loaded["current_skill/SKILL.md"] = current_content

    objective = (
        f"Update the existing '{current_name}' skill. "
        f"The current skill is at /mnt/current_skill/SKILL.md. "
        f"Read ALL reference material in /mnt/references/ and update "
        f"the skill to reflect the latest knowledge. Preserve the skill's "
        f"domain scope but incorporate any new rules, categories, or changes. "
        f"Save the updated skill as SKILL.md."
    )

    backend_client = ApiKeyBackendClient(api_key=GEMINI_API_KEY)
    new_content: str | None = None

    async for event in run_skilled_agent(
        objective=objective,
        skills=[teacher_skill],
        backend=backend_client,
        pre_loaded_files=pre_loaded,
    ):
        etype = getattr(event, "type", "unknown")
        if etype == "complete":
            result = getattr(event, "result", None)
            if result and getattr(result, "intermediate", None):
                for file_data in result.intermediate:
                    if file_data.path.rstrip("/").endswith("SKILL.md"):
                        parts = file_data.content.get("parts", []) if isinstance(file_data.content, dict) else []
                        text = parts[0].get("text", "") if parts else ""
                        if text:
                            new_content = text

    if not new_content:
        raise HTTPException(status_code=500, detail="Teacher did not produce a SKILL.md")

    # Compute fresh hashes for knowledge_sources.
    knowledge_sources = []
    if refs_dir.is_dir():
        for ref_file in sorted(refs_dir.rglob("*.md")):
            if ref_file.parent.name == "_staging":
                continue
            rel = str(ref_file.relative_to(refs_dir))
            h = hashlib.sha256(ref_file.read_bytes()).hexdigest()[:12]
            knowledge_sources.append(f"  - path: {rel}\n    hash: {h}")

    # Inject knowledge_sources into front matter.
    if knowledge_sources:
        ks_block = "knowledge_sources:\n" + "\n".join(knowledge_sources)
        # Insert before closing ---.
        new_content = re.sub(
            r"\n---\s*$",
            f"\n{ks_block}\n---",
            new_content.split("\n---", 1)[0] + "\n---" + (new_content.split("\n---", 1)[1] if "\n---" in new_content else ""),
            count=1,
        )

    skill_path.write_text(new_content)
    new_name, new_desc = parse_skill_front_matter(new_content)
    logger.info("CPD refresh complete for skill '%s'", slug)

    return {
        "slug": slug,
        "name": new_name,
        "description": new_desc,
        "status": "refreshed",
    }


# ─── Journeys ─────────────────────────────────────────────────────────────────


class StartJourneyRequest(BaseModel):
    objective: str


class StartJourneyResponse(BaseModel):
    id: str


@app.post("/journeys/start")
async def api_start_journey(request: StartJourneyRequest) -> StartJourneyResponse:
    """Create a new journey and return its ID.

    View pre-production runs as a background task (LLM generation takes
    time). The frontend polls GET /journeys/{id}/status until views are
    ready.
    """
    journey_id = await journey_router.start_journey(world, request.objective)
    return StartJourneyResponse(id=journey_id)


class SubmitResultRequest(BaseModel):
    payload: dict


@app.post("/journeys/{journey_id}/result")
async def api_submit_result(journey_id: str, request: SubmitResultRequest):
    """Submit a user result for a journey step, advancing the state machine."""
    try:
        update = await journey_router.submit_result(
            world, journey_id, request.payload
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        "journey_id": update.journey_id,
        "new_state": update.new_state,
        "new_label": update.new_label,
        "view_available": update.view_available,
        "complete": update.complete,
        "context": update.context,
    }


@app.get("/journeys/{journey_id}/status")
async def api_journey_status(journey_id: str):
    """Get the current status of a journey."""
    journey = world.get_journey(journey_id)
    if journey is None:
        raise HTTPException(status_code=404, detail="Journey not found")
    projection = journey_router.get_projection(world, journey_id)
    return {
        "id": journey.id,
        "objective": journey.objective,
        "status": journey.status,
        "progress": journey.progress,
        "context": journey.context,
        "view_available": projection is not None,
    }


@app.post("/journeys/{journey_id}/retry")
async def api_retry_journey(journey_id: str):
    """Retry a failed journey generation."""
    try:
        await journey_router.retry_journey(world, journey_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@app.get("/journeys")
async def api_list_journeys():
    """List all journeys."""
    return [
        {
            "id": j.id,
            "objective": j.objective,
            "status": j.status,
            "progress": j.progress,
        }
        for j in world.journeys.values()
    ]


@app.get("/journeys/{journey_id}/bundle")
async def api_journey_bundle(journey_id: str):
    """Return the multipart bundle for the current journey step's view."""
    projection = journey_router.get_projection(world, journey_id)
    if projection is None:
        raise HTTPException(
            status_code=404, detail="No view available for this journey"
        )

    # Build the file list relative to the step's output directory.
    step_dir_name = f"journey-{journey_id}/{projection.state_id}"

    def _stream():
        step_dir = OUT_DIR / step_dir_name
        for rel_path in projection.view_files:
            path = step_dir / rel_path
            if not path.is_file():
                continue
            content_type = (
                mimetypes.guess_type(rel_path)[0] or "application/octet-stream"
            )
            yield f"--{BOUNDARY}\r\n".encode()
            yield f'Content-Disposition: attachment; filename="{rel_path}"\r\n'.encode()
            yield f"Content-Type: {content_type}\r\n".encode()
            yield b"\r\n"
            yield path.read_bytes()
            yield b"\r\n"
        yield f"--{BOUNDARY}--\r\n".encode()

    return StreamingResponse(
        _stream(),
        media_type=f"multipart/mixed; boundary={BOUNDARY}",
    )


@app.delete("/journeys/{journey_id}")
async def api_delete_journey(journey_id: str):
    """Delete a journey and its artifacts."""
    import shutil

    journey = world.journeys.pop(journey_id, None)
    if journey is None:
        raise HTTPException(status_code=404, detail="Journey not found")

    # Remove artifacts from disk.
    journey_dir = OUT_DIR / f"journey-{journey_id}"
    if journey_dir.is_dir():
        shutil.rmtree(journey_dir)

    world.save()
    return {"deleted": journey_id}


@app.get("/agent/runs/{run_id}/reuse")
async def check_reuse(run_id: str):
    """Check which files in a run were reused from the library.

    Source of truth: .ref files created by _promote_to_library.
    If components/PieChart.jsx.ref exists, that component is reused.
    """
    run = runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    run_dir = OUT_DIR / run_id
    result: dict[str, dict] = {}

    for artifact in run.artifacts:
        if not artifact.endswith(".jsx"):
            continue

        ref_path = run_dir / (artifact + ".ref")
        if ref_path.is_file():
            lib_name = ref_path.read_text().strip()
            result[artifact] = {
                "status": "reused",
                "library_file": lib_name,
            }
        else:
            result[artifact] = {"status": "new"}

    return result


async def _stream_run(run: Run):
    """Yield SSE events — replay history, then stream live."""
    yield f"event: start\ndata: {json.dumps({'id': run.id, 'objective': run.objective})}\n\n"

    # Replay events that already happened.
    for event in list(run.events):
        etype = event["type"]
        yield f"event: {etype}\ndata: {json.dumps(event)}\n\n"

    if run.status == "complete":
        return

    # Subscribe for live events.
    queue: asyncio.Queue = asyncio.Queue()
    run.subscribers.append(queue)
    try:
        while True:
            event = await queue.get()
            etype = event["type"]
            yield f"event: {etype}\ndata: {json.dumps(event)}\n\n"
            if etype == "done":
                return
    finally:
        run.subscribers.remove(queue)


@app.get("/agent/runs/{run_id}")
async def stream_run(run_id: str):
    """Stream SSE events for the given run (replay + live)."""
    run = runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return StreamingResponse(
        _stream_run(run),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Artifact bundle
# ---------------------------------------------------------------------------

BOUNDARY = "ark-bundle-boundary"


def _stream_bundle(run_id: str, files: list[str]):
    """Yield a multipart/mixed body with one part per artifact file.

    Resolves .ref files from _library/ — the file served is the library
    copy, but the filename in the multipart response is the original name.
    """
    library_dir = OUT_DIR / "_library"
    run_dir = OUT_DIR / run_id
    for rel_path in files:
        path = run_dir / rel_path
        ref_path = run_dir / (rel_path + ".ref")

        # Resolve .ref -> library.
        if not path.is_file() and ref_path.is_file():
            lib_name = ref_path.read_text().strip()
            path = library_dir / lib_name

        if not path.is_file():
            continue

        content_type = mimetypes.guess_type(rel_path)[0] or "application/octet-stream"
        yield f"--{BOUNDARY}\r\n".encode()
        yield f"Content-Disposition: attachment; filename=\"{rel_path}\"\r\n".encode()
        yield f"Content-Type: {content_type}\r\n".encode()
        yield b"\r\n"
        yield path.read_bytes()
        yield b"\r\n"
    yield f"--{BOUNDARY}--\r\n".encode()


@app.get("/agent/runs/{run_id}/bundle")
async def get_bundle(run_id: str):
    """Return all artifacts for a run as a multipart/mixed bundle."""
    run = runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "complete":
        raise HTTPException(status_code=409, detail="Run not yet complete")
    if not run.artifacts:
        raise HTTPException(status_code=404, detail="No artifacts")
    return StreamingResponse(
        _stream_bundle(run_id, run.artifacts),
        media_type=f"multipart/mixed; boundary={BOUNDARY}",
    )
