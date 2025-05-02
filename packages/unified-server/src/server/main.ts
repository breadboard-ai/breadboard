import express, { type Request } from "express";
import ViteExpress from "vite-express";

import * as connectionServer from "@breadboard-ai/connection-server";
import * as boardServer from "@breadboard-ai/board-server";
import { InputValues, NodeDescriptor } from "@breadboard-ai/types";

const server = express();

const boardServerConfig = boardServer.createServerConfig({
  storageProvider: "firestore",
  proxyServerAllowFilter,
});
const connectionServerConfig = await connectionServer.createServerConfig();

boardServer.addMiddleware(server, boardServerConfig);
server.use("/board", boardServer.createRouter(boardServerConfig));

server.use(
  "/connection",
  connectionServer.createServer(connectionServerConfig)
);

server.use("/app/@:user/:name", boardServer.middlewares.loadBoard());

ViteExpress.config({
  transformer: (html: string, req: Request) => {
    const board = req.res?.locals.loadedBoard;
    const displayName = board?.displayName || "Not Found";
    return html.replace("{{displayName}}", escape(displayName));
  },
});

ViteExpress.static({
  enableBrotli: true,
});

ViteExpress.listen(server, boardServerConfig.port, () => {
  console.log(`Unified server at: http://localhost:${boardServerConfig.port}`);
});

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function proxyServerAllowFilter(
  node: NodeDescriptor,
  inputs: InputValues
): boolean {
  // Not a fetch node, so we'll allow it.
  if (node.type !== "fetch") return true;
  if (!("url" in inputs && inputs.url)) return false;
  if (typeof inputs.url !== "string") return false;

  const url = parseUrl(inputs.url);
  if (!url) return false;
  return url.origin.endsWith(".googleapis.com");
}

function parseUrl(s: string): URL | undefined {
  try {
    return new URL(s);
  } catch (e) {
    return;
  }
}
