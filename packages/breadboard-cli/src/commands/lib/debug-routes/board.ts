import http from "http";
import { ServerGlobals } from "../debug-server.js";
import { extname, join } from "path";
import { loadBoards } from "../utils.js";

export async function board(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  match: URLPatternResult,
  globals: ServerGlobals
) {
  const { boards, options, base } = globals;
  const requestURL = new URL(request.url ?? "", base);
  let board = boards.find((board) => board.url == requestURL.pathname);
  if (!board) {
    const isKitManifest = requestURL.pathname.endsWith(".kit.json");
    const isJSON = extname(requestURL.pathname) === ".json";
    if (isJSON && !isKitManifest) {
      // Attempt to load the board and append it to the list of boards.
      const possibleBoardPath = join(process.cwd(), requestURL.pathname);
      try {
        const newBoards = await loadBoards(possibleBoardPath, options);
        const [newBoard] = newBoards;
        boards.push(newBoard);
        board = newBoard;
      } catch (err) {
        // This board was not found.
      }
    }
  }

  // We only want to serve the file that is being debugged... nothing else.
  if (board) {
    const boardData = JSON.stringify(board);
    response.writeHead(200, {
      "Content-Type": "application/json",
    });

    return response.end(boardData);
  }
}
