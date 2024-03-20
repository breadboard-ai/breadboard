import http from "http";
import { loadBoards } from "../utils.js";
import { ServerGlobals } from "../debug-server.js";

export async function boardList(
  _request: http.IncomingMessage,
  response: http.ServerResponse,
  _match: URLPatternResult,
  globals: ServerGlobals
) {
  const { file, options } = globals;
  const boards = await loadBoards(file, options);
  globals.boards = boards;

  const boardsData = JSON.stringify(
    boards
      .map((board) => ({
        url: board.url,
        version: board.version,
        title: board.title,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  );

  response.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": boardsData.length,
  });

  return response.end(boardsData);
}
