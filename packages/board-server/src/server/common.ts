import { readFile } from "fs/promises";
import type { IncomingMessage, ServerResponse } from "http";
import { dirname, extname, resolve } from "path";
import { fileURLToPath } from "url";
import { notFound } from "./errors.js";
import type { ViteDevServer } from "vite";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../..");
const PROD_PATH = "/dist/client";

const CONTENT_TYPE = new Map([
  [".html", "text/html"],
  [".json", "application/json"],
]);
const DEFAULT_CONTENT_TYPE = "text/plain";

export const root = () => {
  return ROOT_PATH;
};

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Serve a static file
 */
export const serveFile = async (
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
    const resolvedPath = `${root()}${path}`;
    let contents = await readFile(resolvedPath, "utf-8");
    if (transformer) contents = await transformer(contents);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(contents);
  } catch {
    notFound(res, "Static file not found");
  }
};

export const serveContent = async (
  vite: ViteDevServer | null,
  req: IncomingMessage,
  res: ServerResponse
) => {
  const pathname = req.url || "/";
  if (vite === null) {
    serveFile(res, pathname);
  } else {
    vite.middlewares(req, res);
  }
};

export const serveIndex = async (
  vite: ViteDevServer | null,
  res: ServerResponse
) => {
  if (vite === null) {
    return serveFile(res, "/index.html");
  }
  serveFile(res, "/", async (contents: string) => {
    return await vite.transformIndexHtml("/index.html", contents);
  });
};
