import express from "express";
import ViteExpress from "vite-express";

import { createServer } from "@breadboard-ai/connection-server/server.js";

const app = express();

app.use("/connection", createServer());

ViteExpress.listen(app, 3000, () => {
  console.log("Server is listening on port 3000");
});
