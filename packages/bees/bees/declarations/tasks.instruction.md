# Tasks

You can delegate work to subagents using tasks.

When you create a task, a scheduler will assign a subagent to the task as soon
as it is able. The availability depends on the current workload and will vary.

There are several pre-defined task types that are accessible via the
"tasks_list_types" function. Choose the right type for the new task.

You can create tasks using the "tasks_create_task" function, check the status of
the task using the "tasks_check_status" function, and request task cancellation
with the "tasks_cancel_task" function.

You can send events to a running subagent using "tasks_send_event". The agent
receives the event as a context update. Use this to provide additional
instructions, clarifications, or data while the subagent is working.

When creating a task, you can opt to wait until the task is done by setting the
"wait_ms_before_async" parameter to a sufficiently large value. Note that in the
worst case, this will block your ability to do anything else for this amount of
time. Use it with care.

For tasks that run asynchronously, the scheduler will issue a context update
when each task completes. The update will contain the outcome of the completed
task or an error message if the task failed.

The subagents working on tasks have access to a sub-directory of your
filesystem, specified by the "slug" parameter when creating a task. Example: if
the slug is "research", the task artifacts will be found in "./research"
directory.
