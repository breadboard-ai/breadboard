import express from "express";
import ViteExpress from "vite-express";

import * as connectionServer from "@breadboard-ai/connection-server";
import * as boardServer from "@breadboard-ai/board-server";

const server = express();

const boardServerConfig = boardServer.createServerConfig();
const connectionServerConfig = await connectionServer.createServerConfig();

server.use("/board", boardServer.createServer(boardServerConfig));
server.use(
  "/connection",
  connectionServer.createServer(connectionServerConfig)
);

ViteExpress.static({
  enableBrotli: true,
});

ViteExpress.listen(server, boardServerConfig.port, () => {
  console.log(`Unified server at: http://localhost:${boardServerConfig.port}`);
});
