import { readFile } from "fs/promises";
import type { IncomingMessage, ServerResponse } from "http";
import { dirname, extname, resolve } from "path";
import { fileURLToPath } from "url";
import type { ViteDevServer } from "vite";
import { existsSync } from 'fs';

import type { ServerConfig } from "./config.js";
import { notFound, serverError } from "./errors.js";
import type { PageMetadata } from "./types.js";
import { createReadStream } from "fs";

const PROD_PATH = "/dist/client";

const CONTENT_TYPE = new Map([
  [".html", "text/html"],
  [".json", "application/json"],
  [".css", "text/css"],
  [".js", "text/javascript"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
  [".eot", "application/vnd.ms-fontobject"],
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".pdf", "application/pdf"],
  [".md", "text/markdown"],
  [".txt", "text/plain"],
]);
const DEFAULT_CONTENT_TYPE = "text/plain";

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Serve a static file
 */
export const serveFile = async (
  serverConfig: ServerConfig,
  res: ServerResponse,
  path: string,
  transformer?: (contents: string) => Promise<string>
) => {
  if (path == "/") {
    path = "/index.html";
  }
  if (IS_PROD) {
    path = `${PROD_PATH}${path}`;
  }
  const contentType = CONTENT_TYPE.get(extname(path)) || DEFAULT_CONTENT_TYPE;
  try {
    const resolvedPath = `${serverConfig.rootPath}${path}`;
    if (contentType.startsWith("text/") || contentType === "application/json") {
      let contents = await readFile(resolvedPath, "utf-8");
      if (transformer) contents = await transformer(contents);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(contents);
    } else {
      return new Promise<void>((resolve) => {
        const fileStream = createReadStream(resolvedPath);
        res.setHeader("Content-Type", contentType);
        fileStream.pipe(res);
        fileStream.on("error", () => {
          notFound(res, `Static file not found`);
          resolve();
        });
        fileStream.on("end", resolve);
      });
    }
  } catch {
    notFound(res, "Static file not found");
  }
};
export const serveContent = async (
  serverConfig: ServerConfig,
  req: IncomingMessage,
  res: ServerResponse
) => {
  const pathname = req.url || "/";
  const vite = serverConfig.viteDevServer;
  if (vite === null) {
    serveFile(serverConfig, res, pathname);
  } else {
    vite.middlewares(req, res);
  }
};

function escapeHTML(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function replaceMetadata(contents: string, metadata: PageMetadata) {
  return contents
    .replaceAll("{{title}}", escapeHTML(metadata.title))
    .replaceAll("{{description}}", escapeHTML(metadata.description || ''));
}

export const serveIndex = async (
  serverConfig: ServerConfig,
  vite: ViteDevServer | null,
  res: ServerResponse,
  metadataGetter: () => Promise<PageMetadata | null>
) => {
  const metadata = await metadataGetter();
  if (metadata === null) {
    return notFound(res, "Board not found");
  }
  if (vite === null) {
    return serveFile(serverConfig, res, "/index.html", async (contents: string) => {
      return replaceMetadata(contents, metadata);
    });
  }
  serveFile(serverConfig, res, "/", async (contents: string) => {
    return await vite.transformIndexHtml(
      "/index.html",
      replaceMetadata(contents, metadata)
    );
  });
};