import express from 'express';
import bodyParser from 'body-parser';
import { BoardController } from './controllers/boardController.js';
import authenticate from './auth/auth.js';

const app = express();
const port = 3000;

app.use(bodyParser.json());

/**
 * Boards API routing logic:
 * GET /boards/ -> list boards
 * GET /boards/@:user/:name.json -> get a board
 * POST /boards/@:user/:name.json -> create/update/delete a board
 * GET /boards/@:user/:name.app -> serve frontend app for the board
 * GET /boards/@:user/:name.api -> serve API description for the board
 * POST /boards/@:user/:name.api/invoke -> BSE invoke entry point
 * POST /boards/@:user/:name.api/describe -> BSE describe entry point
 * POST /boards/@:user/:name.api/run -> Remote run entry point
 * GET /boards/@:user/:name.invite -> Get list of current invites for the board
 * POST /boards/@:user/:name.invite -> Create a new or delete existing invite
 */

const boardController = new BoardController();


// Board API Routes
app.get('/boards', boardController.list);
app.post('/boards', authenticate, boardController.create);
app.get('/boards/@:user/:boardName.json', boardController.get);
app.post('/boards/@:user/:boardName.json', authenticate, boardController.update);
// app.delete('/boards/@:user/:boardName.json', boardController.delete);
// app.get('/boards/@:user/:boardName.app', boardController.serve);
// app.get('/boards/@:user/:boardName.api', boardController.describe);
// app.post('/boards/@:user/:boardName.api/invoke', boardController.invoke);
// app.post('/boards/@:user/:boardName.api/describe', boardController.describe);
// app.post('/boards/@:user/:boardName.api/run', boardController.run);
// app.get('/boards/@:user/:boardName.invite', boardController.inviteList);
// app.post('/boards/@:user/:boardName.invite', boardController.inviteUpdate);

app.get('/boards/@:user/:boardName.app', boardController.serve);
app.get('/boards/@:user/:boardName.api', boardController.describe);

// Global error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(`Board server listening at http://localhost:${port}`);
});