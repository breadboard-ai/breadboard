"""Ark backend — FastAPI spike server."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Ark Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class EchoRequest(BaseModel):
    message: str


class EchoResponse(BaseModel):
    echo: str


@app.post("/echo")
async def echo(request: EchoRequest) -> EchoResponse:
    """Echo the incoming message back."""
    return EchoResponse(echo=request.message)
