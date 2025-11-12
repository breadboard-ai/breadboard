/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { Connect, Plugin, ViteDevServer } from "vite";
import fs from "fs";
import path from "path";

function estimateMimeType(fileName: string) {
  const ext = path.extname(fileName);
  switch (ext) {
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".mov":
      return "video/mov";
    case ".mp4":
      return "video/mp4";
    case ".wav":
      return "audio/wav";
    case ".ogg":
      return "audio/ogg";
    case ".mp3":
      return "audio/mp3";
    default:
      return "text/plain";
  }
}

function handleRequests(
  server: ViteDevServer,
  fallback: string | undefined,
  reg: RegExp
): Connect.NextHandleFunction | null {
  if (!fallback) {
    return null;
  }

  const fallbackFile = path.resolve(server.config.root, fallback);
  if (!fs.existsSync(fallbackFile)) {
    console.warn(
      `[Fallback] Fallback file not found: ${fallbackFile}. Plugin disabled.`
    );
    return null;
  }

  const fallbackBytes = fs.readFileSync(fallbackFile);
  const fallbackMime = estimateMimeType(fallback);

  return async (req, res, next) => {
    const url = req.url ?? "";
    const isSupportedRequest = reg.test(url);

    if (isSupportedRequest) {
      const requestedFilePath = path.resolve(
        server.config.root,
        "public",
        url.slice(1).split("?")[0]
      );

      // Check if the file *does not* exist on disk
      if (!fs.existsSync(requestedFilePath) && url !== "/") {
        console.log(`[Fallback] Non-existent file: ${url}. Serving fallback.`);

        // Serve the fallback image bytes
        res.statusCode = 200;
        res.setHeader("Content-Type", fallbackMime);
        res.setHeader("Content-Length", fallbackBytes.length);
        res.end(fallbackBytes);

        // Do not call next() as the request is resolved
        return;
      }
    }

    // Not an valid request, or the request *was* found by Vite, so let the next
    // middleware (or Vite's file server) handle it
    next();
  };
}

export function plugin(config: {
  image?: string;
  video?: string;
  audio?: string;
}): Plugin {
  return {
    name: "file-fallback",
    apply: "serve",
    enforce: "post",

    configureServer(server: ViteDevServer) {
      const handleImages = handleRequests(
        server,
        config.image,
        /\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i
      );
      const handleVideo = handleRequests(
        server,
        config.video,
        /\.(mp4|mov)(\?.*)?$/i
      );
      const handleAudio = handleRequests(
        server,
        config.audio,
        /\.(ogg|wav|mp4|m4a)(\?.*)?$/i
      );

      if (handleImages) server.middlewares.use(handleImages);
      if (handleVideo) server.middlewares.use(handleVideo);
      if (handleAudio) server.middlewares.use(handleAudio);
    },
  };
}
