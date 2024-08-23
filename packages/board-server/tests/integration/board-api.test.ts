import { test } from 'node:test';
import assert from 'node:assert';
import { request } from 'node:http';
import { startServer, stopServer } from "../../src/server.js";

import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { createAccount } from '../../src/server/store.js'

let serverInstance: { server: any; port: string | number };

var account: { api_key: any; account?: string; };

test.before(async () => {
  serverInstance = await startServer();
  account = await createAccount('test')
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

function readBoard(name: string) {
      // Get the directory name
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const filePath = path.join(__dirname, `../boards/${name}`);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function makeRequest({
  path,
  method = 'GET',
  body,
  headers
}: {
  path: string;
  method?: string;
  body?: unknown;
  headers: any
}): Promise<{ statusCode: number; data: string }> {

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: headers,
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
    headers: { 'Content-Type': 'application/json' }
  });
  assert.strictEqual(statusCode, 200);
});

test('POST /boards/@test/simple.json should create a new board', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: `/boards/@${account.account}/simple.json?API_KEY=${account.api_key}`,
    method: 'POST',
    body: readBoard('simple.bgl.json'),
    headers: { 'Content-Type': 'application/json' }
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(JSON.parse(body), { "created" : "@test/simple.json" });
});

test('GET /boards/@test/simple.json should get a board', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@test/simple.json',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(JSON.parse(body), readBoard("simple.bgl.json"));
});

test('GET /boards/@test/simple.app should 404 while unpublished', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@test/simple.app',
    method: 'GET',
    headers: {}
  });
  assert.strictEqual(statusCode, 404);
});

test('POST /boards/@test/simple.json should update a board', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: `/boards/@test/simple.json?API_KEY=${account.api_key}`,
    method: 'POST',
    body: readBoard('simple-published.bgl.json'),
    headers: {}
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(JSON.parse(body), { "created" : "@test/simple.json" });
});

test('GET /boards/@test/simple.json should be published', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@test/simple.json',
    method: 'GET',
    headers: {}
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(JSON.parse(body), readBoard("simple-published.bgl.json"));
});

test('GET /boards should list the published board', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards',
    method: 'GET',
    headers: {}
  });
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(JSON.parse(body), [ { title: 'simple', path: 'test/simple.json', username: 'test', readonly: true, mine: false, tags: 'published' } ])
});

test('GET /boards/@test/simple.app should serve frontend app', async () => {
  const { statusCode, data: body } = await makeRequest({
    path: '/boards/@test/simple.app',
    method: 'GET',
    headers: {}
  });
  console.info(body)
  assert.strictEqual(statusCode, 200);
});

// test('GET /boards/@user/board.api should serve API description', async () => {
//   const { statusCode, data: body } = await makeRequest({
//     path: '/boards/@user/board.api',
//     method: 'GET',
//   });
//   assert.strictEqual(statusCode, 200);
//   assert.deepStrictEqual(body, {
//     success: true,
//     type: 'api',
//     board: '@user/board.json',
//     url: 'http://localhost:3000/boards/@user/board.json',
//     user: 'user',
//     name: 'board.json',
//   });
// });

// test('POST /boards/@user/board.api/invoke should invoke API', async () => {
//   const { statusCode, data: body } = await makeRequest({
//     path: '/boards/@user/board.api/invoke',
//     method: 'POST',
//   });
//   assert.strictEqual(statusCode, 200);
//   assert.deepStrictEqual(body, {
//     success: true,
//     type: 'invoke',
//     board: '@user/board.json',
//     url: 'http://localhost:3000/boards/@user/board.json',
//     user: 'user',
//     name: 'board.json',
//   });
// });

// test('GET /boards/@user/board.invite should list invites', async () => {
//   const { statusCode, data: body } = await makeRequest({
//     path: '/boards/@user/board.invite',
//     method: 'GET',
//   });
//   assert.strictEqual(statusCode, 200);
//   assert.deepStrictEqual(body, {
//     success: true,
//     type: 'invite-list',
//     board: '@user/board.json',
//     url: 'http://localhost:3000/boards/@user/board.json',
//     user: 'user',
//     name: 'board.json',
//   });
// });

// test('POST /boards/@user/board.invite should update invites', async () => {
//   const { statusCode, data: body } = await makeRequest({
//     path: '/boards/@user/board.invite',
//     method: 'POST',
//   });
//   assert.strictEqual(statusCode, 200);
//   assert.deepStrictEqual(body, {
//     success: true,
//     type: 'invite-update',
//     board: '@user/board.json',
//     url: 'http://localhost:3000/boards/@user/board.json',
//     user: 'user',
//     name: 'board.json',
//   });
// });