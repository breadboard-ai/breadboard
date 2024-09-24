import type { Request, Response } from 'express';
import { getStore } from '../../../server/store.js';

const inviteList = async (req: Request, res: Response) => {
    const { user, boardName } = req.params;

    // TODO(Tina): See `parse` in board-api-parser. `const board = `@${user}/${name}`;`
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

export default inviteList;