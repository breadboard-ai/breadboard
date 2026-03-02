# `functions/` — Agent Function Groups

Each module defines a **function group** — a set of related functions with an
optional system instruction. The `Loop` merges all groups into a single tool
set.

## Function Groups

| Module        | Factory                         | Functions                                                                                                                                                                                            |
| ------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system.py`   | `get_system_function_group()`   | `system_objective_fulfilled`, `system_failed_to_fulfill_objective`, `system_list_files`, `system_write_file`, `system_read_text_from_file`, `system_create_task_tree`, `system_mark_completed_tasks` |
| `generate.py` | `get_generate_function_group()` | `generate_text`, `generate_and_execute_code`                                                                                                                                                         |
| `image.py`    | `get_image_function_group()`    | `generate_images`                                                                                                                                                                                    |
| `video.py`    | `get_video_function_group()`    | `generate_video`                                                                                                                                                                                     |
| `audio.py`    | `get_audio_function_group()`    | `generate_speech_from_text`, `generate_music_from_text`                                                                                                                                              |
| `chat.py`     | `get_chat_function_group()`     | `chat_request_user_input`, `chat_present_choices`                                                                                                                                                    |

## Anatomy of a Function Group

Each module follows the same pattern:

```python
# 1. Private function definition factory
def _define_my_function(*, file_system, backend, ...):
    async def handler(args: dict, status_cb: StatusUpdateCallback) -> dict:
        status_cb("Working...")
        # ... do work ...
        return {"result": "done"}

    return FunctionDefinition(
        name="my_function",
        description="Does the thing",
        handler=handler,
        parameters_json_schema={...},
    )

# 2. Public group factory
def get_my_function_group(*, file_system, backend, ...):
    mapped = map_definitions([_define_my_function(file_system=file_system)])
    return FunctionGroup(
        instruction="System instruction for the model...",
        **vars(mapped),
    )
```

## Shared Schemas

All functions share parameter schemas from `shared_schemas.py`:

- `STATUS_UPDATE_SCHEMA` — `status_update` string for UI progress
- `TASK_ID_SCHEMA` — `task_id` for task tree tracking
- `FILE_NAME_SCHEMA` — `file_name` for generated file naming

Spread these into `parameters_json_schema["properties"]` via `**`.

## How Functions Are Wired

```
run.py → _build_function_groups()
  ├── get_system_function_group(controller, file_system, task_tree_manager)
  ├── get_generate_function_group(file_system, task_tree_manager, client, backend)
  ├── get_image_function_group(file_system, task_tree_manager, backend)
  ├── get_video_function_group(file_system, task_tree_manager, backend)
  ├── get_audio_function_group(file_system, task_tree_manager, backend)
  └── get_chat_function_group(task_tree_manager, file_system)
```

## TypeScript Provenance

Each function is a port of its TypeScript counterpart. The module docstrings
note the original file (e.g., "Port of `functions/system.ts`"). When in doubt,
check the TS source for expected behavior.
