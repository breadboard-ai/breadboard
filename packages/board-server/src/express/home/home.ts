import type { Request, Response } from 'express';
import packageInfo from "../../../package.json" with { type: "json" };
import { getStore } from "../../server/store.js";
import { asyncHandler } from "../support.js";

const home = async (req: Request, res: Response): Promise<void> => {
  const store = getStore();
  const info = await store.getServerInfo();
  const title = info?.title ?? "Board Server";
  const description =
    info?.description ??
    `A server that hosts <a href="https://breadboard-ai.github.io/breadboard/">Breadboard</a> boards.`;

  res.send(`<!DOCTYPE html>
    <html>
      <head><title>${title}</title></head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
        <p>Version: ${packageInfo.version}</p>
      </body>
    </html>`);
};

const homeHandler = asyncHandler(home);
export { homeHandler as home };