---
name: create-task-type
title: How to Create Custom Agent Types (Sub-Agents)
description:
  Learn how to design and write custom agent templates (sub-agents) inside your workspace, so you can delegate specialized work to custom sub-agents.
allowed-tools:
  - agents.list_types
  - agents.assign_task
---

You have the ability to dynamically design and spawn custom, highly-specialized sub-agents. This is done by authoring a YAML agent template inside your workspace's `templates/` directory.

## How to Create a Custom Agent Type

1. **Design the Sub-Agent**: Decide what capabilities (functions), instructions (objective/skills), and model the sub-agent needs.
2. **Write the Template File**: Write a YAML file into `templates/{name}.yaml` in your workspace. 
   - Replace `{name}` with a URL-safe, lower-case name (e.g., `sql-optimizer.yaml`).
   - Ensure the file conforms to the Template Schema below.
3. **List and Spawn**: Call `agents_list_types` to verify the new type is loaded, then call `agents_assign_task` to spawn it!

## Template Schema Reference

A template file must be a YAML dictionary with the following fields:

- **`name`**: (string) Logical identifier (e.g. `sql-optimizer`). Must match the filename without `.yaml`.
- **`title`**: (string) A short human-readable name shown in UIs (e.g. `SQL Performance Optimizer`).
- **`description`**: (string) A brief sentence describing what this sub-agent does.
- **`objective`**: (string) The core instructions/prompt for the agent.
  - *Tip*: Use `{{system.context}}` in the objective to pass through your delegation instructions when assigning a task.
- **`functions`**: (array of strings, optional) Allowed function glob patterns. 
  - Common values: `["files.*", "system.*"]` (for simple workers) or `["files.*", "agents.*", "system.*"]` (if the sub-agent needs to delegate to other agents).
  - Leaving `functions` empty/omitted grants access to ALL available functions.
- **`skills`**: (array of strings, optional) Names of active skills to load (e.g. `["research"]`).
- **`model`**: (string, optional) Specific model override (e.g., `gemini-3.1-pro-preview`).

### Example Template File (`templates/sql-optimizer.yaml`):
```yaml
name: sql-optimizer
title: SQL Performance Optimizer
description: Analyzes SQL files and optimizes slow queries.
objective: |
  You are a database performance expert. Your job is to optimize the SQL query passed via context:

  {{system.context}}

  Read the files, profile the queries, and write the optimized query to optimized.sql.
functions:
  - files.*
  - system.*
skills:
  - research
```

## Best Practices

- **Free the Main Thread**: Delegate complex, long-running, or analytical work to custom sub-agents so you remain responsive to the user/parent.
- **Principle of Least Privilege**: Restrict the sub-agent's `functions` to only what it needs. For example, simple workers don't need `agents.*` or `chat.*`.
- **Objective Interpolation**: Always include `{{system.context}}` in the sub-agent's objective so you can supply it with custom instructions when assigning a task.
- **Clean Namespaces**: Always write templates inside the `templates/` directory of your workspace (e.g., `templates/my-agent.yaml`). Do not try to write to other folders.
