/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import express from "express";
import { GoogleAuth } from "google-auth-library";
import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { mock } from "node:test";
import { makeDriveProxyMiddleware } from "../src/drive-proxy.js";

interface RecordedRequest {
  url: string;
  method: string;
}

interface TestEnvironment {
  upstreamRequests: RecordedRequest[];
  upstreamServer: http.Server;
  proxyServer: http.Server;
  proxyUrl: string;
}

async function setupTestEnvironment(
  shouldCacheMedia: (id: string) => boolean = (id) => id === "featured-1"
): Promise<TestEnvironment> {
  const upstreamRequests: RecordedRequest[] = [];
  const upstreamServer = http.createServer((req, res) => {
    upstreamRequests.push({
      url: req.url ?? "",
      method: req.method ?? "GET",
    });

    if (req.url?.includes("/featured-1")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ title: "Legitimate Featured App" }));
      return;
    }
    if (req.url?.includes("/unfeatured-1")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ title: "Non-Featured File" }));
      return;
    }
    if (req.url?.includes("/error-file")) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "internal server error" }));
      return;
    }
    if (req.url?.includes("/attacker-1")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ title: "Malicious Attacker Graph" }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  await new Promise<void>((resolve) =>
    upstreamServer.listen(0, "127.0.0.1", resolve)
  );
  const upstreamPort = (upstreamServer.address() as AddressInfo).port;

  mock.method(GoogleAuth.prototype, "getClient", async () => ({
    getAccessToken: async () => ({ token: "fake-token" }),
  }));
  mock.method(GoogleAuth.prototype, "getProjectId", async () => "fake-project");
  mock.method(
    https,
    "request",
    (
      options: https.RequestOptions,
      callback?: (res: http.IncomingMessage) => void
    ) => {
      return http.request(
        {
          ...options,
          hostname: "127.0.0.1",
          port: upstreamPort,
        },
        callback
      );
    }
  );

  const app = express();
  app.use(
    makeDriveProxyMiddleware({
      shouldCacheMedia,
      mediaCacheMaxAgeSeconds: 60,
    })
  );

  const proxyServer = http.createServer(app);
  await new Promise<void>((resolve) =>
    proxyServer.listen(0, "127.0.0.1", resolve)
  );
  const proxyPort = (proxyServer.address() as AddressInfo).port;
  const proxyUrl = `http://127.0.0.1:${proxyPort}`;

  return {
    upstreamRequests,
    upstreamServer,
    proxyServer,
    proxyUrl,
  };
}

function teardownTestEnvironment(env: TestEnvironment): Promise<void> {
  mock.restoreAll();
  return new Promise((resolve) => {
    env.proxyServer.close(() => {
      env.upstreamServer.close(() => {
        resolve();
      });
    });
  });
}

test.serial(
  "rejects requests containing fileId query parameter with 400 Bad Request",
  async (t) => {
    const env = await setupTestEnvironment();
    try {
      const res = await fetch(
        `${env.proxyUrl}/drive/v3/files/featured-1?alt=media&fileId=attacker-1`
      );
      t.is(res.status, 400);
      const body = (await res.json()) as { error?: { message?: string } };
      t.truthy(body.error?.message);
      t.is(env.upstreamRequests.length, 0);
    } finally {
      await teardownTestEnvironment(env);
    }
  }
);

test.serial(
  "rejects requests containing file_id or mixed-case FileId query parameters",
  async (t) => {
    const env = await setupTestEnvironment();
    try {
      const resUnderscore = await fetch(
        `${env.proxyUrl}/drive/v3/files/featured-1?alt=media&file_id=attacker-1`
      );
      t.is(resUnderscore.status, 400);

      const resMixedCase = await fetch(
        `${env.proxyUrl}/drive/v3/files/featured-1?alt=media&FileId=attacker-1`
      );
      t.is(resMixedCase.status, 400);

      t.is(env.upstreamRequests.length, 0);
    } finally {
      await teardownTestEnvironment(env);
    }
  }
);

test.serial(
  "strips extraneous query parameters from upstream cached media requests",
  async (t) => {
    const env = await setupTestEnvironment();
    try {
      const res = await fetch(
        `${env.proxyUrl}/drive/v3/files/featured-1?alt=media&extra=ignored`
      );
      t.is(res.status, 200);
      t.is(env.upstreamRequests.length, 1);
      t.is(
        env.upstreamRequests[0]!.url,
        "/drive/v3/files/featured-1?alt=media"
      );
    } finally {
      await teardownTestEnvironment(env);
    }
  }
);

test.serial(
  "fetches and caches legitimate media for featured files",
  async (t) => {
    const env = await setupTestEnvironment();
    try {
      const res1 = await fetch(
        `${env.proxyUrl}/drive/v3/files/featured-1?alt=media`
      );
      t.is(res1.status, 200);
      const body1 = (await res1.json()) as { title: string };
      t.is(body1.title, "Legitimate Featured App");
      t.is(env.upstreamRequests.length, 1);
      t.is(
        env.upstreamRequests[0]!.url,
        "/drive/v3/files/featured-1?alt=media"
      );

      // Second request should hit cache and NOT invoke upstream again
      const res2 = await fetch(
        `${env.proxyUrl}/drive/v3/files/featured-1?alt=media`
      );
      t.is(res2.status, 200);
      const body2 = (await res2.json()) as { title: string };
      t.is(body2.title, "Legitimate Featured App");
      t.is(env.upstreamRequests.length, 1);
    } finally {
      await teardownTestEnvironment(env);
    }
  }
);

test.serial(
  "proxies non-cached media directly without caching",
  async (t) => {
    const env = await setupTestEnvironment();
    try {
      const res1 = await fetch(
        `${env.proxyUrl}/drive/v3/files/unfeatured-1?alt=media`
      );
      t.is(res1.status, 200);
      const body1 = (await res1.json()) as { title: string };
      t.is(body1.title, "Non-Featured File");
      t.is(env.upstreamRequests.length, 1);

      const res2 = await fetch(
        `${env.proxyUrl}/drive/v3/files/unfeatured-1?alt=media`
      );
      t.is(res2.status, 200);
      t.is(env.upstreamRequests.length, 2);
    } finally {
      await teardownTestEnvironment(env);
    }
  }
);

test.serial("does not cache non-200 error responses", async (t) => {
  const env = await setupTestEnvironment((id) => id === "error-file");
  try {
    const res1 = await fetch(
      `${env.proxyUrl}/drive/v3/files/error-file?alt=media`
    );
    t.is(res1.status, 500);
    t.is(env.upstreamRequests.length, 1);

    // Subsequent request should retry upstream rather than returning cached 500
    const res2 = await fetch(
      `${env.proxyUrl}/drive/v3/files/error-file?alt=media`
    );
    t.is(res2.status, 500);
    t.is(env.upstreamRequests.length, 2);
  } finally {
    await teardownTestEnvironment(env);
  }
});
