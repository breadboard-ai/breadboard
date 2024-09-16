import type { Request, Response } from 'express';
import list from './handlers/list.js';
import get from './handlers/get.js';
import create from './handlers/create.js';
import update from './handlers/update.js';
// import del from './handlers/delete.js';
// import invoke from './handlers/invoke.js';
// import describe from './handlers/describe.js';
// import run from './handlers/run.js';
// import inviteList from './handlers/invite-list.js';
// import inviteUpdate from './handlers/invite-update.js';
// import { serveIndex } from '../../server/common.js';

export class BoardController { 
    constructor() {}

    list(req: Request, res: Response) {
        list(req, res);
    }

    get(req: Request, res: Response) {
        get(req, res);
    }

    create(req: Request, res: Response) {
        create(req, res);
    }

    update(req: Request, res: Response) {
        update(req, res);
    }

    // delete(req: Request, res: Response) {
    //     del(req, res);
    // }

    // invoke(req: Request, res: Response) {
    //     invoke(req, res);
    // }

    // describe(req: Request, res: Response) {
    //     describe(req, res);
    // }

    // run(req: Request, res: Response) {
    //     run(req, res);
    // }

    // inviteList(req: Request, res: Response) {
    //     inviteList(req, res);
    // }

    // inviteUpdate(req: Request, res: Response) {
    //     inviteUpdate(req, res);
    // }

    // serve(req: Request, res: Response) {
    //     serveIndex(req, res);
    // }
}