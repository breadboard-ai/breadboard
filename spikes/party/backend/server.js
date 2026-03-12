/* eslint-disable no-undef */
// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Party sync server — y-websocket relay + Gemini agent endpoint.
 *
 * Two responsibilities:
 *  1. WebSocket relay for Yjs CRDT sync (port 4444)
 *  2. HTTP server for Gemini agent requests (port 4445)
 *
 * The agent endpoint connects as a server-side Yjs client to the same
 * room, sets awareness (presence as "🤖 Gemini"), calls the Gemini API,
 * and writes results directly into the shared CRDT state. Both browser
 * tabs see items materialize in real-time.
 */

import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import path from "path";
import http from "http";
// Use CJS require for yjs — must be the SAME instance y-websocket loads.
// ESM import creates a separate module instance, causing "Unexpected content type" errors.
import dotenv from "dotenv";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"),
});

// ── y-websocket setup ─────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const utilsPath = path.join(
  __dirname,
  "node_modules",
  "y-websocket",
  "bin",
  "utils.cjs"
);
const require = createRequire(import.meta.url);
const { setupWSConnection, getYDoc } = require(utilsPath);
const Y = require("yjs");

const WS_PORT = 4444;
const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);
});

console.log(`🔌 WebSocket relay on ws://localhost:${WS_PORT}`);

// ── Gemini setup ──────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── HTTP server for agent requests ────────────────────────────────

const HTTP_PORT = 4445;

const httpServer = http.createServer(async (req, res) => {
  // CORS headers.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/agent") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad request" }));
      return;
    }

    const { prompt, target, room = "party-default" } = JSON.parse(body);

    // Respond immediately — agent runs in background.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "started" }));

    // Fire-and-forget: errors surface via CRDT sentinel.
    runAgent(room, target, prompt).catch((err) => {
      console.error("Agent error:", err);
      // Push error into CRDT so the frontend can show it.
      const doc = getYDoc(room);
      const root = doc.getMap("state");
      root.set("_agent", { status: "error", message: err.message });
      setTimeout(() => root.set("_agent", null), 5000);
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`🤖 Agent API on http://localhost:${HTTP_PORT}/api/agent`);
});

// ── Agent logic ───────────────────────────────────────────────────

async function runAgent(room, target, prompt) {
  console.log(
    `🤖 Agent starting: room=${room} target=${target} prompt="${prompt}"`
  );
  const doc = getYDoc(room);
  const root = doc.getMap("state");

  console.log("🤖 Setting _agent = thinking");
  root.set("_agent", { status: "thinking", target });

  try {
    console.log("🤖 Calling Gemini...");
    const items = await callGemini(target, prompt, root);
    console.log(`🤖 Gemini returned ${items.length} items`);

    root.set("_agent", { status: "writing", target });

    // The bridge initializes arrays as Y.Array, but dual Yjs imports
    // break instanceof. Duck-type: if it has .push(), it's a Y.Array.
    let targetArray = root.get(target);

    if (!targetArray || typeof targetArray.push !== "function") {
      // Array doesn't exist yet — create it.
      console.log(`🤖 Creating Y.Array for "${target}"`);
      targetArray = new Y.Array();
      root.set(target, targetArray);
    }

    for (const item of items) {
      await sleep(400);
      const ymap = new Y.Map();
      for (const [k, v] of Object.entries(item)) {
        ymap.set(k, v);
      }
      targetArray.push([ymap]);
      console.log("🤖 Pushed item:", JSON.stringify(item));
    }
  } catch (err) {
    console.error("🤖 Error in runAgent:", err);
    throw err;
  } finally {
    await sleep(300);
    root.set("_agent", null);
    console.log("🤖 Agent done, cleared _agent sentinel");
  }
}

/**
 * Call Gemini REST API directly with fetch + API key.
 */
async function callGemini(target, prompt, root) {
  const currentState = serializeRoot(root);

  const systemPrompt = `You are a helpful party planning assistant. You help with party planning by generating structured data.

Current party state:
${JSON.stringify(currentState, null, 2)}

The user is asking about the "${target}" section. Generate items to add.

IMPORTANT: Respond with a JSON array of objects. Each object should match the schema for the "${target}" section:
${target === "guests" ? '- Guest: { "name": string, "addedBy": "🤖 Gemini" }' : ""}
${target === "tasks" ? '- Task: { "text": string, "done": false, "addedBy": "🤖 Gemini", "completedBy": "" }' : ""}

Respond with ONLY the JSON array, no markdown fences, no explanation.`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `${systemPrompt}\n\nUser request: ${prompt}` }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "[]";

  // Strip markdown fences if present.
  const cleaned = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse Gemini response:", text);
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function serializeRoot(root) {
  const result = {};
  for (const [key, value] of root.entries()) {
    if (key.startsWith("_")) continue; // Skip internal fields.
    if (value instanceof Y.Array) {
      result[key] = value.toArray().map((item) => {
        if (item instanceof Y.Map) {
          const obj = {};
          for (const [k, v] of item.entries()) {
            obj[k] = v;
          }
          return obj;
        }
        return item;
      });
    } else if (value instanceof Y.Map) {
      result[key] = {};
      for (const [k, v] of value.entries()) {
        result[key][k] = v;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}
