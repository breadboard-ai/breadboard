import type { Request, Response } from 'express';
import { getStore } from '../../server/store.js';
import { asyncHandler } from '../support.js';

const inviteUpdate = async (req: Request, res: Response) => {
    const { user, boardName } = req.params;

    const boardPath = `@${user}/${boardName}`;

    const username = res.locals.username;
    const store = getStore();

    if (!req.body || Object.keys(req.body).length === 0) {
        // create new invite
        const result = await store.createInvite(username, boardPath);
        if (!result.success) {
            // TODO: Be nice and return a proper error code
            res.json({ error: result.error });
            return;
        }

        res.status(200).json({ invite: result.invite });
    } else {
        // delete invite
        const del = req.body as { delete: string };
        if (!del.delete) {
            return;
        }
        const result = await store.deleteInvite(username, boardPath, del.delete);
        if (!result.success) {
            // TODO: Be nice and return a proper error code
            res.json({ error: result.error });
            return;
        }
        res.status(200).json({ deleted: del.delete });
    }
};

const boardInviteUpdate = asyncHandler(inviteUpdate);
export { boardInviteUpdate as inviteUpdate };
