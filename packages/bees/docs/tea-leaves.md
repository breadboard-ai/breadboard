# Tea Leaves

Speculative, ambitious, and less well-defined ideas. These are real pressures
that will eventually need answers, but the design space is wide open.

## Production Attachment

The aspirational workflow: attach to a production instance and have task data
stream to local disk for observation with hivetool. This is a sync protocol:
the production store projects its state onto a local hive directory, and
hivetool reads it as if it were a local run.

Prerequisite: the storage backend protocol from [future.md](./future.md).

## Multi-Hive Support

A user should be able to run multiple hives simultaneously. Use cases: A/B
testing different template configurations, running evaluations against a
baseline, comparing swarm behavior across variants.

**What's blocking**: The scheduler currently assumes a single hive. The hive
path, template registry, and ticket store are effectively singletons. Supporting
multiple hives means making these instance-scoped rather than module-scoped —
which overlaps with the library extraction work.
