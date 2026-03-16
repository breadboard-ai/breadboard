# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Transport abstraction for the NotSoSafeSandbox.

The SandboxTransport protocol defines the contract. Concrete transports
implement it. The client doesn't know or care which one it's using.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

__all__ = ["SandboxResult", "SandboxTransport", "HttpTransport", "GrpcTransport"]

logger = logging.getLogger(__name__)


# ─── Domain Types ────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SandboxResult:
    """Outcome of a capability run."""
    output: dict[str, str] = field(default_factory=dict)
    logs: str = ""
    error: str = ""

    @property
    def ok(self) -> bool:
        return not self.error


# ─── Transport Protocol ─────────────────────────────────────────────────────


@runtime_checkable
class SandboxTransport(Protocol):
    """Contract for communicating with an execution surface."""

    def run(
        self,
        capability: str,
        files: dict[str, str],
        options: dict[str, str] | None = None,
    ) -> SandboxResult:
        """Run a capability with the given files and options."""
        ...

    def close(self) -> None:
        """Release any resources held by the transport."""
        ...


# ─── HTTP Transport ──────────────────────────────────────────────────────────


class HttpTransport:
    """Talk to the execution surface over HTTP."""

    def __init__(self, base_url: str = "http://localhost:50052") -> None:
        self._base_url = base_url.rstrip("/")

    def run(
        self,
        capability: str,
        files: dict[str, str],
        options: dict[str, str] | None = None,
    ) -> SandboxResult:
        import urllib.request
        import urllib.error

        payload = json.dumps({
            "capability": capability,
            "files": files,
            "options": options or {},
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{self._base_url}/run",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return SandboxResult(
                    output=data.get("output", {}),
                    logs=data.get("logs", ""),
                    error=data.get("error", ""),
                )
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(body)
                return SandboxResult(error=data.get("error", body))
            except json.JSONDecodeError:
                return SandboxResult(error=body)
        except Exception as e:
            return SandboxResult(error=str(e))

    def close(self) -> None:
        pass  # Stateless.


# ─── gRPC Transport ─────────────────────────────────────────────────────────


class GrpcTransport:
    """Talk to the execution surface over gRPC.

    Demonstrates transport flexibility — same SandboxTransport protocol,
    different wire format. Uses ``proto/sandbox.proto`` (SandboxService.Run).

    gRPC dependencies (``grpcio``, ``grpc_tools``) are lazy-imported so
    HTTP-only usage doesn't require them.
    """

    def __init__(self, target: str = "localhost:50051") -> None:
        self._target = target
        self._channel = None
        self._stub = None

    def _ensure_connected(self):
        if self._channel is not None:
            return

        import grpc
        from pathlib import Path

        proto_path = Path(__file__).resolve().parent.parent.parent / "proto"
        proto_file = "sandbox.proto"

        # Dynamic stub generation from .proto — no codegen step needed.
        from grpc_tools import protoc
        import tempfile
        import importlib.util
        import sys

        with tempfile.TemporaryDirectory() as tmp:
            protoc.main([
                "grpc_tools.protoc",
                f"--proto_path={proto_path}",
                f"--python_out={tmp}",
                f"--grpc_python_out={tmp}",
                proto_file,
            ])

            # Import the generated modules.
            for mod_name in ["sandbox_pb2", "sandbox_pb2_grpc"]:
                spec = importlib.util.spec_from_file_location(
                    mod_name, f"{tmp}/{mod_name}.py"
                )
                mod = importlib.util.module_from_spec(spec)
                sys.modules[mod_name] = mod
                spec.loader.exec_module(mod)

        import sandbox_pb2_grpc

        self._channel = grpc.insecure_channel(self._target)
        self._stub = sandbox_pb2_grpc.SandboxServiceStub(self._channel)

    def run(
        self,
        capability: str,
        files: dict[str, str],
        options: dict[str, str] | None = None,
    ) -> SandboxResult:
        import sandbox_pb2

        self._ensure_connected()

        request = sandbox_pb2.RunRequest(
            capability=capability,
            files=files,
            options=options or {},
        )

        try:
            response = self._stub.Run(request, timeout=30)
            return SandboxResult(
                output=dict(response.output),
                logs=response.logs,
                error=response.error,
            )
        except Exception as e:
            return SandboxResult(error=str(e))

    def close(self) -> None:
        if self._channel is not None:
            self._channel.close()
            self._channel = None
            self._stub = None
