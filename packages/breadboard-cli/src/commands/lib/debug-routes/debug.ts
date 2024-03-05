import http from "http";
import { ServerGlobals } from "../debug-server.js";

export async function debug(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  match: URLPatternResult,
  globals: ServerGlobals
) {
  const { clients } = globals;

  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const clientId =
    Date.now() +
    Buffer.from(crypto.getRandomValues(new Uint32Array(10))).toString("hex");
  response.on("close", () => {
    delete clients[clientId];
  });
  clients[clientId] = response;
  return response;
}
