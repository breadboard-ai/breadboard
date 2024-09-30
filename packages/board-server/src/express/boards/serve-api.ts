import type { Request, Response } from 'express';
import { serveFile } from '../../server/common.js';
import { asyncHandler } from '../support.js';
const serveApi = async (req: Request, res: Response) => {
    await serveFile(res.locals.serverConfig, res, "/api.html");
};

const boardServeApi = asyncHandler(serveApi);
export { boardServeApi as serveApi };