# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Folio")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_root():
    return {"message": "Folio API is running"}

@app.get("/folio/blocks")
async def get_blocks():
    return [
        {
            "id": "1",
            "type": "markdown",
            "status": "done",
            "content": {"text": "Hello from Folio!"},
            "timestamp": 1713100000
        },
        {
            "id": "2",
            "type": "task",
            "status": "running",
            "content": {"objective": "Building Folio UI"},
            "timestamp": 1713100005
        }
    ]

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

