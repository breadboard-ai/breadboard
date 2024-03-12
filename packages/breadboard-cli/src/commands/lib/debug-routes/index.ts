import http from "http";
import { createReadStream } from "fs";
import { ServerGlobals } from "../debug-server.js";

export async function index(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  match: URLPatternResult,
  globals: ServerGlobals
) {
  const { options, distDir } = globals;

  if ("watch" in options) {
    response.writeHead(200, {
      "Content-Type": "text/html",
    });

    // Need to check this doesn't include "../" and other escape characters.
    const fileStream = createReadStream(`${distDir}/index.html`);
    fileStream.pipe(response, { end: false });
    fileStream.on("end", () => {
      response.write(`<!-- Added by Debug command --><script>
const evtSource = new EventSource("/~~debug");
evtSource.addEventListener("update", () => { window.location.reload(); });</script>`);
      response.end();
    });
    return response;
  }
  return;
}
