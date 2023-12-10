/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { fileURLToPath, pathToFileURL } from 'url'
import { stat } from 'fs/promises';
import { Stats, createReadStream } from 'fs';
import { join, dirname } from 'path';
import handler from 'serve-handler';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const debug = async (file: string) => {
  let fileStat: Stats;
  let fileUrl: URL;

  if (file != undefined) {
    fileStat = await stat(file);
    fileUrl = pathToFileURL(file);
  }

  const distDir = join(__dirname, "..", "..", "ui");
  //const distDir = dirname(fileURLToPath(distPath));
  const server = http.createServer((request, response) => {
    // You pass two more arguments for config and middleware
    // More details here: https://github.com/vercel/serve-handler#options
    const requestURL = new URL(request.url ?? '', 'http://localhost:3000');
    const boardUrl = new URL(fileUrl.pathname ?? '', 'http://localhost:3000');

    // We only want to serve the file that is being debugged... nothing else.
    if (fileStat != undefined && requestURL.pathname === boardUrl.pathname) {

      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': fileStat.size
      });

      const readStream = createReadStream(file);
      readStream.pipe(response);
      return;
    }

    return handler(request, response, { public: distDir });
  });

  server.listen(3000, () => {
    console.log(`Running at http://localhost:3000/${(fileUrl != undefined ? `?board=${fileUrl.pathname}` : '')}`);
  });
};
