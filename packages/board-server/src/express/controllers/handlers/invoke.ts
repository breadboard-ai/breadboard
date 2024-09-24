import type { Request, Response } from 'express';
import { verifyKey } from '../../../server/boards/utils/verify-key.js';
import { secretsKit } from '../../../server/proxy/secrets.js';
import { loadFromStore } from '../../../server/boards/utils/board-server-provider.js';
import { invokeBoard } from '../../../server/boards/utils/invoke-board.js';

const invoke = async (req: Request, res: Response) => {
    const { user, boardName } = req.params;
    const url = req.url || ""; // TODO(Tina): I don't think this is a full URL. Also, in the old implementation, the url from the board-api-parser is used (see #getAdjustedBoardURL)
    const { inputs } = req.body as Record<string, any>;
    const keyVerificationResult = await verifyKey(user!, boardName!, inputs);
    if (!keyVerificationResult.success) {
        res.status(200).json({ $error: keyVerificationResult.error }); // TODO(Tina): The original status code was 200, but I feel like it should be 
        return;
    }
    const result = await invokeBoard({
        url,
        path: boardName!,
        inputs,
        loader: loadFromStore,
        kitOverrides: [secretsKit],
      });
      res.json({ result })
};

export default invoke;