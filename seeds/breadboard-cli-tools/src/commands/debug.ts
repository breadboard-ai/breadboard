import { fileURLToPath, pathToFileURL } from 'url'
import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { dirname } from 'path';
import handler from 'serve-handler';
import http from 'http';

export const debug = async (file: string) => {
  let fileStat: any;
  let fileUrl: URL;

  if (file != undefined) {
    fileStat = await stat(file);
    fileUrl = pathToFileURL(file);
  }

  // We are assuming that this package will be published.
  // @ts-ignore
  const distPath = await import("@google-labs/breadboard-web/dist");
  const distDir = dirname(fileURLToPath(distPath.path));
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
