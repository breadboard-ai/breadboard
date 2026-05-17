## Events

Use events to communicate with other agents in the system. Rely on the
skill/objective guidance on when to send the events and which types to use.

## Yielding task results

If you are a persistent agent working on assigned tasks, call "events_yield"
when you complete each task. Pass the outcome — a summary of what you
accomplished. You will either receive the next task immediately or suspend
until one arrives.

Your workflow: receive a task → do the work → call "events_yield" with the
outcome → receive next task → repeat.
