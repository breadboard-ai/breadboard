import { test } from 'node:test';
import assert from 'node:assert';
import { request } from 'node:http';
import { startServer, stopServer } from "../../src/server.js";

let serverInstance: { server: any; port: string | number };

test.before(async () => {
  serverInstance = await startServer();
});

test.after(async () => {
  await stopServer(serverInstance.server);
});

process.on('uncaughtException', async (err) => {
  console.error('Uncaught Exception:', err);
  if (serverInstance) {
    await stopServer(serverInstance.server);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled Rejection:', reason);
  if (serverInstance) {
    await stopServer(serverInstance.server);
  }
  process.exit(1);
});

function makeRequest({
  path,
  method = 'GET',
  body,
}: {
  path: string;
  method?: string;
  body?: unknown;
}): Promise<{ statusCode: number; data: string }> {

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = request(options, (res) => {
      let data = '';

      // Log the request details
      console.log(`${method} http://localhost:${options.port}${path}`);
      if (body) {
        console.log(`Request body: ${JSON.stringify(body, null, 2)}`);
      }

      // Log response status
      console.log(`Response status: ${res.statusCode}`);

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 500, data });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    // If there's a body, write it to the request
    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}


// Tests
test('GET /boards should list boards', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards',
    method: 'GET',
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(body, { success: true, type: 'list' }); // Adjust expected response as needed
});

test('POST /boards/ should create a new board', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/',
    method: 'POST',
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(body, { success: true, type: 'create' }); // Adjust expected response as needed
});

test('GET /boards/@user/board.json should get a board', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@user/board.json',
    method: 'GET',
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(body, {
    success: true,
    type: 'get',
    board: '@user/board.json',
    url: 'http://localhost:3000/boards/@user/board.json',
    user: 'user',
    name: 'board.json',
  });
});

test('POST /boards/@user/board.json should update a board', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@user/board.json',
    method: 'POST',
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(body, {
    success: true,
    type: 'update',
    board: '@user/board.json',
    url: 'http://localhost:3000/boards/@user/board.json',
    user: 'user',
    name: 'board.json',
  });
});

test('GET /boards/@user/board.app should serve frontend app', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@user/board.app',
    method: 'GET',
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(body, {
    success: true,
    type: 'app',
    board: '@user/board.json',
    url: 'http://localhost:3000/boards/@user/board.json',
    user: 'user',
    name: 'board.json',
  });
});

test('GET /boards/@user/board.api should serve API description', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@user/board.api',
    method: 'GET',
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(body, {
    success: true,
    type: 'api',
    board: '@user/board.json',
    url: 'http://localhost:3000/boards/@user/board.json',
    user: 'user',
    name: 'board.json',
  });
});

test('POST /boards/@user/board.api/invoke should invoke API', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@user/board.api/invoke',
    method: 'POST',
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(body, {
    success: true,
    type: 'invoke',
    board: '@user/board.json',
    url: 'http://localhost:3000/boards/@user/board.json',
    user: 'user',
    name: 'board.json',
  });
});

test('GET /boards/@user/board.invite should list invites', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@user/board.invite',
    method: 'GET',
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(body, {
    success: true,
    type: 'invite-list',
    board: '@user/board.json',
    url: 'http://localhost:3000/boards/@user/board.json',
    user: 'user',
    name: 'board.json',
  });
});

test('POST /boards/@user/board.invite should update invites', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@user/board.invite',
    method: 'POST',
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(body, {
    success: true,
    type: 'invite-update',
    board: '@user/board.json',
    url: 'http://localhost:3000/boards/@user/board.json',
    user: 'user',
    name: 'board.json',
  });
});