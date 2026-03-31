# Project Filefly — Unified Disk-Backed File System

Replace the in-memory `AgentFileSystem` bridge hacks with a single,
disk-backed file system for bees. The opal-backend browser path stays
untouched.

## Background

Two file systems coexist today:

1. **AgentFileSystem** (opal-backend) — in-memory `/mnt/`-prefixed
   virtual FS, designed for the browser where there is no disk.
2. **Disk directory** (bees) — `ticket_dir/filesystem/`, the actual
   working directory for bash.

Five bridge hacks keep them in sync: bidirectional sandbox sync,
`/mnt/` path stripping, skill file mirroring, post-completion file
extraction, and full-FS snapshot serialization on suspend. All of them
are O(n)-per-call or redundant.

## Design

- **Protocol extraction**: a `FileSystem` protocol in opal-backend
  captures the contract that consumers actually use.
- **DiskFileSystem**: a new implementation in bees that reads/writes
  directly to `work_dir/`. Paths are relative. No `/mnt/` prefix.
- **Injection**: `run()` and the Sessions API accept an optional
  `file_system` parameter. Bees provides `DiskFileSystem`; browser
  Opal continues with `AgentFileSystem`.
- **Hack deletion**: sandbox sync, path translation, skill mirroring,
  and snapshot bloat are eliminated.

## Phases

### Phase 1 — Protocol + DiskFileSystem ✅

🎯 **Objective**: `DiskFileSystem` passes a standalone test suite that
exercises `write` / `read_text` / `get` / `list_files` / `files` /
`snapshot` / `add_system_file` against real disk paths — including
binary files returning Gemini `inlineData` parts.

- [x] Extract `FileSystem` protocol in `opal_backend/file_system_protocol.py`
- [x] Implement `DiskFileSystem` in `bees/disk_file_system.py`
- [x] Write `tests/test_disk_file_system.py` — 36 tests passing

---

### Phase 2 — Thread Through run() / Sessions API ✅

🎯 **Objective**: `run()` accepts an injected `file_system` and a
bees integration test proves a session round-trips (start → bash
write → list_files → complete) using `DiskFileSystem` without any
sync hacks.

- [x] Add `file_system` param to `run()` / `resume()` in `run.py`
- [x] Add `file_system` to `_SessionContext` / `new_session()` in `api.py`
- [x] Make `InteractionState.file_system` optional for disk-backed path
- [x] Update type annotations in `run.py` (`_SessionHooksImpl`, `_stream_loop`)
- [x] Replace `_file_to_part` with shared `file_descriptor_to_part`

---

### Phase 3 — Wire Bees + Delete Hacks ✅

🎯 **Objective**: `npm run test -w packages/bees` passes with
`DiskFileSystem` as the default, sandbox sync is deleted, and a
full ticket drain round-trip works end-to-end.

- [x] Wire `DiskFileSystem` in `session.py` (`run_session` / `resume_session`)
- [x] Seed skills directly to disk via `disk_fs.write()` (replaces `initial_files`)
- [x] Delete `_sync_agent_fs_to_disk` / `_sync_disk_to_agent_fs` from `sandbox.py`
- [x] Delete `_is_binary` / `_content_hash` helpers from `sandbox.py`
- [x] Delete `/mnt/` path translation wrappers from `simple_files.py`
- [x] Delete skill file mirroring hack from `session.py`
- [x] Simplify `extract_files()` to handle both bare and legacy paths
- [x] Delete `test_sandbox_sync.py` (tested deleted sync code)
- [x] Update skill SKILL.md files to use bare paths (no `/mnt/`)
- [x] All tests pass: 620 total (537 opal-backend + 36 disk FS + 47 bees)

---

### Phase 4 — Type Annotation Cleanup

🎯 **Objective**: All opal-backend consumers that accept a file system
are typed against the `FileSystem` protocol. `mypy` (or equivalent)
passes with no new errors.

- [ ] `functions/system.py` — `FileSystem` type
- [ ] `functions/chat.py` — `FileSystem` type
- [ ] `functions/generate.py` — `FileSystem` type
- [ ] `functions/memory.py` — `FileSystem` type
- [ ] `pidgin.py` — `FileSystem` type
- [ ] `task_tree_manager.py` — `FileSystem` type
- [ ] `function_definition.py` — `SessionHooks.file_system` type
