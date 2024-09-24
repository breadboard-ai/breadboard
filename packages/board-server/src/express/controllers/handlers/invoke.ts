import type { Request, Response } from 'express';
import { verifyKey } from '../../../server/boards/utils/verify-key.js';
import { secretsKit } from '../../../server/proxy/secrets.js';
import { loadFromStore } from '../../../server/boards/utils/board-server-provider.js';
import { invokeBoard } from '../../../server/boards/utils/invoke-board.js';
import { getStore } from '../../../server/store.js';

const invoke = async (req: Request, res: Response) => {
    const { user, boardName } = req.params;
    const { ...inputs } = req.body as Record<string, any>;
    const keyVerificationResult = await verifyKey(user!, boardName!, inputs);
    if (!keyVerificationResult.success) {
        res.status(403).json({ $error: keyVerificationResult.error }); // TODO(Tina): The original status code was 200
        return;
    }
    const store = getStore();

    const board = await store.get(user!, boardName!);

    if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
    }

    const API_ENTRY = "/boards";
    const userAndBoardName = `@${user}/${boardName}`;
    const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    url.pathname = `${API_ENTRY}/${userAndBoardName}`;
    url.search = "";
    const href = url.href.endsWith(".json") ? url.href : `${url.href}.json`;

    const result = await invokeBoard({
        url: href,
        path: userAndBoardName,
        inputs,
        loader: loadFromStore,
        kitOverrides: [secretsKit],
    });
    res.json({ result })
};

export default invoke;