import type { Request, Response } from 'express';
import { getStore, type ServerInfo } from "../../server/store.js";
import packageInfo from "../../../package.json" with { type: "json" };
import { asyncHandler } from "../support.js";

const DEFAULT_SERVER_INFO: ServerInfo = {
  title: "Board Server",
  description: "A server for Breadboard boards",
  capabilities: {
    boards: {
      path: "/boards",
      read: "open",
      write: "key",
    },
  },
};

const info = async (req: Request, res: Response): Promise<void> => {
  const store = getStore();
  const info = (await store.getServerInfo()) || DEFAULT_SERVER_INFO;
  const version = packageInfo.version;

  res.json({ ...info, version });
};

const infoHandler = asyncHandler(info);
export { infoHandler as info };
