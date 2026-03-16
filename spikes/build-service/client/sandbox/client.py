# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""NotSoSafeSandbox — capability-based execution client.

In honour of Ark's DangerousSandbox, but with a transport layer
so the execution surface can live anywhere.

Usage:
    sandbox = NotSoSafeSandbox(HttpTransport("http://localhost:50052"))
    result = sandbox.run("esbuild", {"App.jsx": "import React..."})
    if result.ok:
        bundle = result.output["bundle.cjs"]
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .transport import SandboxTransport, SandboxResult

__all__ = ["NotSoSafeSandbox"]

logger = logging.getLogger(__name__)


class NotSoSafeSandbox:
    """General-purpose execution surface.

    Thin wrapper over a SandboxTransport — exists to provide a clean
    API surface and a place for future concerns (retries, caching,
    capability validation, metrics).
    """

    def __init__(self, transport: SandboxTransport) -> None:
        self._transport = transport

    def run(
        self,
        capability: str,
        files: dict[str, str],
        options: dict[str, str] | None = None,
    ) -> SandboxResult:
        """Run a named capability with the given files.

        Args:
            capability: What to do — e.g. "esbuild", "npm", "python".
            files: Input files keyed by relative path.
            options: Capability-specific options.

        Returns:
            SandboxResult with .output (named files), .logs, or .error.
        """
        logger.info(
            "Running '%s' with %d file(s)",
            capability,
            len(files),
        )

        result = self._transport.run(capability, files, options)

        if result.ok:
            logger.info(
                "Capability '%s' succeeded (%d output(s))",
                capability,
                len(result.output),
            )
        else:
            logger.error("Capability '%s' failed: %s", capability, result.error)

        return result

    def close(self) -> None:
        """Release transport resources."""
        self._transport.close()

    def __enter__(self) -> NotSoSafeSandbox:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
