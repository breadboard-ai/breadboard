import { Routes } from "./debug-server.js";
import { boards } from "./debug-routes/boards.js";
import { kits } from "./debug-routes/kits.js";
import { kit } from "./debug-routes/kit.js";
import { debug } from "./debug-routes/debug.js";
import { board } from "./debug-routes/board.js";

// This is the main routing table for the debug server.
export const routes: Routes = {
  "/boards.js": boards,
  "/kits.json": kits,
  "/kits/:kitName(.*)": kit,
  "/~~debug": debug,
  "/*.json": board, // after kits.json
};
