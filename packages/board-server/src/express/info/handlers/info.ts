import type { Request, Response } from 'express';
import { getStore, type ServerInfo } from "../../../server/store.js";
import packageInfo from "../../../../package.json" with { type: "json" };

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

export const infoHandler = async (req: Request, res: Response): Promise<void> => {
  const store = getStore();
  const info = (await store.getServerInfo()) || DEFAULT_SERVER_INFO;
  const version = packageInfo.version;

  res.json({ ...info, version });
};