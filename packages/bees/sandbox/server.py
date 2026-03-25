# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any

app = FastAPI(title="Bees Sandbox Sidecar")

class RunScriptRequest(BaseModel):
    command: list[str]
    files: dict[str, str]

@app.get("/")
def root():
    return {"status": "sandbox running"}

@app.post("/run_script")
def run_script_endpoint(req: RunScriptRequest) -> dict[str, Any]:
    """Execute arbitrary command in sandbox isolation with provided files manifest."""
    from sandbox.runner import run
    result = run(req.command, input_files=req.files)
    return {
        "exit_code": result.exit_code,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "output_files": result.output_files,
    }

if __name__ == "__main__":
    # Use port 3500 as outlined in context
    uvicorn.run(app, host="127.0.0.1", port=3500)
