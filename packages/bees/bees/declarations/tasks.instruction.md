# Tasks

You can delegate work to subagents using tasks.

When you create a task, a scheduler will assign a subagent to the task as soon
as it is able. The availability depends on the current workload and will vary.

Available task types are resolved dynamically via the "tasks_list_types"
function. New task templates or overrides can be created or modified inside the
`templates/` directory of your workspace during execution. You MUST always call
"tasks_list_types" to discover the current, most up-to-date list of available
task types before creating a task, especially if you or the system have
dynamically created or edited templates. When listing task types, check their
"options_schema" to see what configuration overrides (if any) can be supplied
via the "options" parameter of "tasks_create_task".

You can create tasks using the "tasks_create_task" function, check the status of
the task using the "tasks_check_status" function, and request task cancellation
with the "tasks_cancel_task" function.

You can send events to a running subagent using "tasks_send_event". The agent
receives the event as a context update. Use this to provide additional
instructions, clarifications, or data while the subagent is working.

Tasks run asynchronously — "tasks_create_task" returns immediately with a
task ID and status. The scheduler issues a context update when each task
completes, containing the outcome or an error message.

To wait for task results, call "tasks_await". This suspends your execution
until a context update arrives (e.g. a child task completes or a parent sends
you an event). If updates are already pending, it returns immediately.

Typical workflow:
1. Create one or more tasks with "tasks_create_task".
2. Call "tasks_await" to suspend until a task completes.
3. Check results with "tasks_check_status".
4. Repeat or proceed based on results.

The subagents working on tasks have access to a sub-directory of your
filesystem, specified by the "slug" parameter when creating a task. You provide
a simple directory name (e.g., "research"). If you are yourself a subagent, the
system automatically nests your slug under your own working directory. For
example, if you work in "./app" and create a task with slug "tests", the child
will work in "./app/tests".

## Tasks and user input

To successfully complete tasks, subagents may be equipped with the ability to
chat with the user. This may result in multi-threaded conversations: you are
talking wtih the user, as well as your subagents are talking with the user. This
is perfectly fine and is a good pattern of separating conversations on different
topics.

## Task statuses

When you check on your tasks, each task has a status. Tasks created by your
subagents also appear as nested subtasks, giving you visibility into the full
tree of work.

- **available** — the task is queued and waiting for a subagent to pick it up.
- **blocked** — the task has unresolved dependencies and cannot start yet.
- **running** — a subagent is actively working on the task.
- **suspended** — the subagent is waiting for user input.
- **paused** — the task is temporarily paused by the scheduler.
- **completed** — the task finished successfully. The outcome will be delivered
  to you as a context update.
- **failed** — the task encountered an unrecoverable error.
- **cancelled** — the task was cancelled before completion.
