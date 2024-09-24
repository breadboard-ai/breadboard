import type { Request, Response } from 'express';
import { getStore } from '../../../server/store.js';
import { verifyKey } from '../../../server/boards/utils/verify-key.js';
import { runBoard, timestamp } from '../../../server/boards/utils/run-board.js';
import { loadFromStore } from '../../../server/boards/utils/board-server-provider.js';
import { secretsKit } from '../../../server/proxy/secrets.js';
import type { RemoteMessage } from '@google-labs/breadboard/remote';

const run = async (req: Request, res: Response) => {
    const { user, boardName } = req.params;
    // TODO(Tina): The first part of the condition will always be true
    // const url = `${req.protocol}://${req.get('host')}${req.originalUrl}` || ""; // TODO(Tina): In the old implementation, the url from the board-api-parser is used (see #getAdjustedBoardURL)
    const API_ENTRY = "/boards";
    const userAndBoardName = `@${user}/${boardName}`;
    const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`); // Check this
    url.pathname = `${API_ENTRY}/${userAndBoardName}`;
    url.search = "";
    console.log("href:" + url.href);

    const {
        $next: next,
        $diagnostics: diagnostics,
        ...inputs
    } = req.body as Record<string, any>;
    const writer = new WritableStream<RemoteMessage>({
        write(chunk) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
      }).getWriter();
    res.setHeader("Content-Type", "text/event-stream");
    res.statusCode = 200;

    const store = getStore();

    const board = await store.get(user!, boardName!);

    if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
    }

    const keyVerificationResult = await verifyKey(user!, boardName!, inputs);

    if (!keyVerificationResult.success) {
        await writer.write([
          "graphstart",
          {
            path: [],
            timestamp: timestamp(),
            graph: { nodes: [], edges: [] },
          },
        ]);
        await writer.write([
          "error",
          { error: "Invalid or missing key", code: 403, timestamp: timestamp() },
        ]);
        await writer.write([
          "graphend",
          {
            path: [],
            timestamp: timestamp(),
          },
        ]);
        await writer.close();
        res.end();
        return;
      }
      console.log("path:" + board)
    await runBoard({
        url: url.href,
        path: board,
        user: keyVerificationResult.user!,
        inputs,
        loader: loadFromStore,
        kitOverrides: [secretsKit],
        writer,
        next,
        runStateStore: store,
        diagnostics,
    });
    res.end();
};

export default run;