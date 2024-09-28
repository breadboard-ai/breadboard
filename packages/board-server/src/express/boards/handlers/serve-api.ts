import type { Request, Response } from 'express';
import { serveFile } from '../../../server/common.js';

const serveApi = async (req: Request, res: Response) => {
    await serveFile(res.locals.serverConfig, res, "/api.html");
};

export default serveApi;