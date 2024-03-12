import http from "http";
import { ServerGlobals } from "../debug-server.js";

export async function kits(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  match: URLPatternResult,
  globals: ServerGlobals
) {
  const { kits } = globals;
  const responseText = JSON.stringify(
    kits.map((kit) => `/kits/${kit.file}`) || []
  );

  response.writeHead(200, {
    "Content-Type": "application/javascript",
    "Content-Length": responseText.length,
  });

  return response.end(responseText);
}
