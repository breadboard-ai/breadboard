# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""NotSoSafeSandbox — general execution surface for agent-produced artifacts.

In honour of Ark's DangerousSandbox, this is the slightly-less-dangerous
version. It provides a capability-based execution API: instead of a single
build() endpoint, you call run(capability, files, options).

Usage:
    from sandbox.client import NotSoSafeSandbox
    from sandbox.transport import HttpTransport

    sandbox = NotSoSafeSandbox(HttpTransport())
    result = sandbox.run("esbuild", {"App.jsx": "..."})
    if result.ok:
        print(result.output["bundle.cjs"])
"""

from .client import NotSoSafeSandbox
from .transport import SandboxResult, SandboxTransport, HttpTransport, GrpcTransport

__all__ = [
    "NotSoSafeSandbox",
    "SandboxResult",
    "SandboxTransport",
    "HttpTransport",
    "GrpcTransport",
]
