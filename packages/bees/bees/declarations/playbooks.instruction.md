# Playbooks

You can list and run playbooks. A playbook is a way to delegate work to other
agents.

Use `playbooks_list` to discover available playbooks. Use
`playbooks_run_playbook` to execute one by name.

## Briefing Pattern

When running a playbook, always supply a `context` string describing what the
user wants and fully capture the context so that the other agent succeed in
doing its work. Include the user's topic, preferences, constraints, and any
other relevant details.

You do not need to worry about the internal mechanics of the playbook — just
provide good context and trust the agent to deliver.

## Delegation and Completion

Running a playbook is an act of delegation. Therefore, you do not need to wait
for a playbook to complete or retrieve its results.
