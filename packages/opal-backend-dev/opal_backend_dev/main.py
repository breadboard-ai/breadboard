# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Opal dev backend server.

For local development:
  - New agent APIs → wire directly to opal-backend-shared
  - Existing One Platform APIs → proxy to OPAL_BACKEND_API_PREFIX

Run with: uvicorn opal_backend_dev.main:app --reload --port 8080
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Opal Dev Backend",
    description="Local development backend for Opal",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# The target for proxying existing One Platform APIs.
UPSTREAM_BASE = os.environ.get(
    "OPAL_BACKEND_API_PREFIX",
    "https://appcatalyst.pa.googleapis.com",
)


@app.get("/")
async def root():
    """Landing page."""
    return {
        "name": "Opal Dev Backend",
        "upstream": UPSTREAM_BASE,
        "status": "stub — agent APIs will be wired in Phase 4.2",
    }


# TODO(phase-4.2): Mount agent-run endpoints from opal-backend-shared
# TODO(phase-4.2): Add proxy middleware for existing v1beta1/* APIs
