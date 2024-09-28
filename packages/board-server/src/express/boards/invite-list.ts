import type { Request, Response } from 'express';
import { getStore } from '../../server/store.js';
import { asyncHandler } from '../support.js';

const inviteList = async (req: Request, res: Response) => {
    const { user, boardName } = req.params;

    const boardPath = `@${user}/${boardName}`;

    const username = res.locals.username;
    const store = getStore();
    const result = await store.listInvites(username, boardPath);
    if (!result.success) {
        // TODO(Tina): Add a proper error code
        res.json({ error: result.error });
        return;
    }
    res.json({ invites: result.invites });
};

const boardInviteList = asyncHandler(inviteList);
export { boardInviteList as inviteList };