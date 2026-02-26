# `local/` — Not Synced to Production

This directory contains code shared between `opal-backend-dev` and
`opal-backend-fake` but **not** synced to the production backend.

The production backend has its own HTTP plumbing (One Platform API surface). The
code here defines the FastAPI route structure and request/response models used
only by the local dev and fake wrappers.

Everything outside this directory IS synced to production.
