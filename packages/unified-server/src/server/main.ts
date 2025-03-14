import express, { type Request } from "express";
import ViteExpress from "vite-express";

import * as connectionServer from "@breadboard-ai/connection-server";
import * as boardServer from "@breadboard-ai/board-server";

const server = express();

const boardServerConfig = boardServer.createServerConfig();
const connectionServerConfig = await connectionServer.createServerConfig();

boardServer.addMiddleware(server);
server.use("/board", boardServer.createRouter(boardServerConfig));

server.use(
  "/connection",
  connectionServer.createServer(connectionServerConfig)
);

server.use("/app/@:user/:name", boardServer.middlewares.loadBoard());

ViteExpress.config({
  transformer: (html: string, req: Request) => {
    const board = req.res?.locals.loadedBoard;
    const displayName = board?.displayName || "Not Found";
    return html.replace("{{displayName}}", displayName);
  },
});

ViteExpress.static({
  enableBrotli: true,
});

ViteExpress.listen(server, boardServerConfig.port, () => {
  console.log(`Unified server at: http://localhost:${boardServerConfig.port}`);
});
