import http from "http";
import { ServerGlobals } from "../debug-server.js";

export async function kit(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  match: URLPatternResult,
  globals: ServerGlobals
) {
  const { kits } = globals;
  const { kitName } = match.pathname.groups;
  const kit = kits.find((kit) => kit.file === kitName);
  if (kit) {
    if ("data" in kit) {
      response.writeHead(200, {
        "Content-Type": "application/javascript",
      });

      return response.end(kit.data);
    } else {
      response.writeHead(302, {
        Location: kit.url,
      });
      return response.end();
    }
  }
  return response.end();
}
