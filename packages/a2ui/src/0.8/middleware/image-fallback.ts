/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Plugin, ViteDevServer } from "vite";
import fs from "fs";
import path from "path";

export function plugin(fallbackPath = "public/default-fallback.png"): Plugin {
  return {
    name: "image-fallback",
    apply: "serve",
    enforce: "post",

    configureServer(server: ViteDevServer) {
      const FALLBACK_FILE = path.resolve(server.config.root, fallbackPath);
      if (!fs.existsSync(FALLBACK_FILE)) {
        console.warn(
          `[image-fallback] Fallback file not found: ${FALLBACK_FILE}. Plugin disabled.`
        );
        return;
      }

      const fallbackBytes = fs.readFileSync(FALLBACK_FILE);
      const fallbackMime =
        path.extname(fallbackPath) === ".png" ? "image/png" : "image/jpeg";

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        // Check if the request looks like an image URL
        const isImageRequest = /\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(url);

        if (isImageRequest) {
          const requestedFilePath = path.resolve(
            server.config.root,
            "public",
            url.slice(1).split("?")[0]
          );

          // Check if the file *does not* exist on disk
          if (!fs.existsSync(requestedFilePath) && url !== "/") {
            console.log(
              `[image-fallback] Non-existent image: ${url}. Serving fallback.`
            );

            // Serve the fallback image bytes
            res.statusCode = 200;
            res.setHeader("Content-Type", fallbackMime);
            res.setHeader("Content-Length", fallbackBytes.length);
            res.end(fallbackBytes);

            // Do not call next() as the request is resolved
            return;
          }
        }

        // Not an image request, or the image *was* found by Vite,
        // or the image *does* exist, so let the next middleware
        // (or Vite's file server) handle it
        next();
      });
    },
  };
}
