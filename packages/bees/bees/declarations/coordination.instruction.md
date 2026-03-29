## Coordination Signals

Use `coordination_emit` to send a typed signal to other agents in the system.
Signals are routed by the scheduler to all agents that have declared a matching
`watch_events` entry for the signal type.

This is a fire-and-forget mechanism — you emit the signal and continue your
work. You will not receive a response from the subscribers.

Use signals when:

- You have completed a meaningful unit of work that other agents should know
  about
- You want to trigger a downstream process
- You need to share context with a collaborating agent

Choose `signal_type` values that are descriptive and stable. Subscribers match
on exact signal type strings.
