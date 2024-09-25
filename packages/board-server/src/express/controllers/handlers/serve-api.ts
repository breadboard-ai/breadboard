import type { Request, Response } from 'express';
import { serveFile } from '../../../server/common.js';

const serveApi = async (req: Request, res: Response) => {
    await serveFile({ hostname: req.hostname, rootPath: req.rootPath }, res, "/api.html");
};

export default serveApi;