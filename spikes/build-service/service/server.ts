/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NotSoSafeSandbox Service — dual-protocol capability server.
 *
 * gRPC: SandboxService.Run on port 50051
 * HTTP:  POST /run on port 50052
 *
 * Both delegate to the same capability registry.
 * Demonstrates transport flexibility — clients pick their protocol.
 */

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildBundle } from "./builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = resolve(__dirname, "../proto/sandbox.proto");

const GRPC_PORT = 50051;
const HTTP_PORT = 50052;

// ─── Capabilities ───────────────────────────────────────────────────────────

interface CapabilityRequest {
  files: Record<string, string>;
  options?: Record<string, string>;
}

interface CapabilityResult {
  output: Record<string, string>;
  logs: string;
  error: string;
}

type CapabilityHandler = (
  req: CapabilityRequest
) => Promise<CapabilityResult>;

/**
 * esbuild capability — compiles React/JSX sources into a CJS bundle.
 */
async function esbuildCapability(
  req: CapabilityRequest
): Promise<CapabilityResult> {
  const result = await buildBundle({
    files: req.files,
    assets: req.options ?? {},
  });
  return {
    output: { "bundle.cjs": result.code },
    logs: "",
    error: "",
  };
}

/** Registry of available capabilities. */
const capabilities: Record<string, CapabilityHandler> = {
  esbuild: esbuildCapability,
};

/** Dispatch a capability by name. */
async function dispatch(
  capability: string,
  files: Record<string, string>,
  options: Record<string, string>
): Promise<CapabilityResult> {
  const handler = capabilities[capability];
  if (!handler) {
    return {
      output: {},
      logs: "",
      error: `Unknown capability: "${capability}". Available: ${Object.keys(capabilities).join(", ")}`,
    };
  }
  return handler({ files, options });
}

// ─── gRPC Types ─────────────────────────────────────────────────────────────

interface RunRequest {
  capability: string;
  files: Record<string, string>;
  options: Record<string, string>;
}

interface SandboxServiceDefinition {
  sandbox: {
    SandboxService: {
      service: grpc.ServiceDefinition;
    };
  };
}

// ─── gRPC Server ────────────────────────────────────────────────────────────

function startGrpcServer(): void {
  const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const proto = grpc.loadPackageDefinition(
    packageDef
  ) as unknown as SandboxServiceDefinition;

  const server = new grpc.Server();

  server.addService(proto.sandbox.SandboxService.service, {
    Run: async (
      call: grpc.ServerUnaryCall<RunRequest, CapabilityResult>,
      callback: grpc.sendUnaryData<CapabilityResult>
    ) => {
      const { capability, files, options } = call.request;
      try {
        const result = await dispatch(capability, files ?? {}, options ?? {});
        callback(null, result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        callback(null, { output: {}, logs: "", error: message });
      }
    },
  });

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err) => {
      if (err) {
        console.error("gRPC bind failed:", err);
        process.exit(1);
      }
      console.log(`gRPC server listening on port ${GRPC_PORT}`);
      console.log(`  SandboxService.Run — capability-based execution`);
    }
  );
}

// ─── HTTP Server ────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString()));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function startHttpServer(): void {
  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      if (req.url !== "/run" || req.method !== "POST") {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      try {
        const body = await readBody(req);
        const { capability, files, options } = JSON.parse(body);
        const result = await dispatch(
          capability,
          files ?? {},
          options ?? {}
        );
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: message }));
      }
    }
  );

  server.listen(HTTP_PORT, () => {
    console.log(`HTTP server listening on port ${HTTP_PORT}`);
    console.log(`  POST /run — capability-based execution`);
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log("Starting NotSoSafeSandbox Service...\n");
startGrpcServer();
startHttpServer();
console.log(
  `\nCapabilities: ${Object.keys(capabilities).join(", ")}`
);
