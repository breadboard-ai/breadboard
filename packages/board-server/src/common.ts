import { readFile } from "fs/promises";
import type { IncomingMessage, ServerResponse } from "http";
import { dirname, extname, resolve } from "path";
import { fileURLToPath } from "url";
import { notFound } from "./errors.js";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../");

const CONTENT_TYPE = new Map([
  [".html", "text/html"],
  [".json", "application/json"],
]);
const DEFAULT_CONTENT_TYPE = "text/plain";

export const root = () => {
  return ROOT_PATH;
};

/**
 * Serve a static file
 */
export const serveFile = async (
  res: ServerResponse,
  path: string,
  transformer?: (contents: string) => Promise<string>
) => {
  const contentType = CONTENT_TYPE.get(extname(path)) || DEFAULT_CONTENT_TYPE;
  try {
    const resolvedPath = resolve(root(), path);
    let contents = await readFile(resolvedPath, "utf-8");
    if (transformer) contents = await transformer(contents);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(contents);
  } catch {
    notFound(res, "Static file not found");
  }
};

export const serveIndex = async (
  req: IncomingMessage,
  res: ServerResponse,
  transformer: (contents: string) => Promise<string>
) => {
  const url = req.url;
  if (!url) {
    // Don't know how to serve this, let's bail.
    return;
  }

  // We parse the URL here because we may have search params included in the
  // URL, and that prevents us from finding a match to `/`. With a parsed URL we
  // can just look at the pathname property and go from there.
  const fullUrl = new URL(url, `http://${req.headers.host}`);
  const { pathname } = fullUrl;
  if (pathname === "/" || pathname === "/index.html") {
    serveFile(res, "index.html", transformer);
    return;
  }

  notFound(res, "Page Not Found. Are you looking for '/index.html' maybe?");
};
