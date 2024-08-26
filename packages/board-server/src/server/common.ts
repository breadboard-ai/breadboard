import { readFile } from "fs/promises";
import type { IncomingMessage, ServerResponse } from "http";
import { dirname, extname, resolve } from "path";
import { fileURLToPath } from "url";
import type { ViteDevServer } from "vite";
import { existsSync } from 'fs';

import type { ServerConfig } from "./config.js";
import { notFound } from "./errors.js";
import type { PageMetadata } from "./types.js";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));

function findRootPath() {
  let currentPath = MODULE_PATH;
  while (currentPath !== '/') {
    if (existsSync(resolve(currentPath, 'package.json'))) {
      return currentPath;
    }
    currentPath = dirname(currentPath);
  }
  throw new Error('Unable to find project root');
}

const ROOT_PATH = findRootPath();
const PROD_PATH = "/dist/client";

const IS_PROD = process.env.NODE_ENV === "production";

export const root = () => IS_PROD ? resolve(ROOT_PATH, '..') : ROOT_PATH;

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

export const serveFile = async (
  res: ServerResponse,
  path: string,
  transformer?: (contents: string) => Promise<string>
) => {
  console.log(`Attempting to serve file: ${path}`);
  if (path == "/") {
    path = "/index.html";
  }
  if (IS_PROD) {
    path = `${PROD_PATH}${path}`;
  }
  console.log(`Adjusted path: ${path}`);
  const contentType = CONTENT_TYPE.get(extname(path)) || DEFAULT_CONTENT_TYPE;
  try {
    const resolvedPath = resolve(root(), path.replace(/^\//, ''));
    console.log(`Resolved path: ${resolvedPath}`);
    console.log(`File exists: ${existsSync(resolvedPath)}`);
    let contents = await readFile(resolvedPath, "utf-8");
    if (transformer) contents = await transformer(contents);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(contents);
  } catch (err) {
    console.error(`Error serving file: ${err}`);
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
    serveFile(res, pathname);
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
  vite: ViteDevServer | null,
  res: ServerResponse,
  metadataGetter: () => Promise<PageMetadata | null>
) => {
  const metadata = await metadataGetter();
  if (metadata === null) {
    return notFound(res, "Board not found");
  }
  if (vite === null) {
    return serveFile(res, "/index.html", async (contents: string) => {
      return replaceMetadata(contents, metadata);
    });
  }
  serveFile(res, "/", async (contents: string) => {
    return await vite.transformIndexHtml(
      "/index.html",
      replaceMetadata(contents, metadata)
    );
  });
};