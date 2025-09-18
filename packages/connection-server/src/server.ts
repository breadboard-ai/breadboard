/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import express, { type Express } from "express";
import type { Request, Response } from "express";

import { grant } from "./api/grant.js";
import { list } from "./api/list.js";
import { refresh } from "./api/refresh.js";
import { loadConnections, type SameSite, type ServerConfig } from "./config.js";
import cookieParser from "cookie-parser";

export type { ServerConfig };

/**
 * Create a ServerConfig from environment variables.
 *
 * Parses the file at CONNECTIONS_FILE for connections, and reads
 * ALLOWED_ORIGINS for CORS. Both values are empty by default if absent.
 *
 * Fails if CONNECTIONS_FILE is set but no file is found.
 */
export async function createServerConfig(): Promise<ServerConfig> {
  console.log("[connection-server startup] Creating connection server config");

  const connectionsFile = process.env.CONNECTIONS_FILE;
  const connections = connectionsFile
    ? await loadConnections(connectionsFile)
    : new Map();

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(/\s+/)
    .filter((origin) => origin !== "");

  const refreshTokenCookieSameSite = (process.env[
    "REFRESH_TOKEN_COOKIE_SAME_SITE"
  ] || "Strict") as SameSite;
  if (!["Lax", "Strict", "None"].includes(refreshTokenCookieSameSite)) {
    throw Error(
      `Invalid REFRESH_TOKEN_COOKIE_SAME_SITE value: ${refreshTokenCookieSameSite}`
    );
  }
  return { allowedOrigins, connections, refreshTokenCookieSameSite };
}

export function createServer(config: ServerConfig): Express {
  const server = express();

  server.use(
    cors({
      credentials: true,
      // Different browsers allow different max values for max age. The highest
      // seems to be 24 hours.
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
      maxAge: 24 * 60 * 60,
      origin: config.allowedOrigins,
    })
  );

  server.use(cookieParser());

  // TODO: #3172 - Common error handling

  server.get("/list", async (req: Request, res: Response) =>
    list(req, res, config)
  );

  server.get("/grant", async (req: Request, res: Response) =>
    grant(req, res, config)
  );

  server.get("/refresh", async (req: Request, res: Response) =>
    refresh(req, res, config)
  );

  return server;
}
