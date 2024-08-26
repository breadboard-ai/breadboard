import { suite, test } from 'node:test';
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

suite('Board API Integration tests', async () => {
// Tests
  test('GET /boards should list boards', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: '/boards',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(statusCode, 200);
  });

  test('POST /boards/@test/simple.json should create a new board', { concurrency: false },  async () => {
    const { statusCode, data: body } = await makeRequest({
      path: `/boards/@${account.account}/simple.json?API_KEY=${account.api_key}`,
      method: 'POST',
      body: readBoard('simple.bgl.json'),
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(statusCode, 200);
    assert.deepStrictEqual(JSON.parse(body), { "created" : "@test/simple.json" });
  });

  test('GET /boards/@test/simple.json should get a board', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: '/boards/@test/simple.json',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(statusCode, 200);
    assert.deepStrictEqual(JSON.parse(body), readBoard("simple.bgl.json"));
  });

  test('GET /boards should be empty while @test/simple.json is unpublished', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: '/boards',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(statusCode, 200);
    assert.deepStrictEqual(JSON.parse(body), []);
  });

  test('POST /boards/@test/simple.json should update a board', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: `/boards/@test/simple.json?API_KEY=${account.api_key}`,
      method: 'POST',
      body: readBoard('simple-published.bgl.json'),
      headers: {}
    });
    assert.strictEqual(statusCode, 200);
    assert.deepStrictEqual(JSON.parse(body), { "created" : "@test/simple.json" });
  });

  test('GET /boards/@test/simple.json should be published', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: '/boards/@test/simple.json',
      method: 'GET',
      headers: {}
    });
    assert.strictEqual(statusCode, 200);
    assert.deepStrictEqual(JSON.parse(body), readBoard("simple-published.bgl.json"));
  });

  test('GET /boards should list the published board', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: '/boards',
      method: 'GET',
      headers: {}
    });
    assert.strictEqual(statusCode, 200);
    assert.deepStrictEqual(JSON.parse(body), [ { title: 'simple', path: 'test/simple.json', username: 'test', readonly: true, mine: false, tags: 'published' } ])
  });

  test('GET /boards/@test/simple.app should serve frontend app', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: '/boards/@test/simple.app',
      method: 'GET',
      headers: {}
    });
    console.info(body)
    assert.strictEqual(statusCode, 200);
  });

  test('GET /boards/@test/simple.api should serve API explorer', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: '/boards/@test/simple.api',
      method: 'GET',
      headers: {}
    });
    assert.strictEqual(statusCode, 200);
    assert(body.includes('<bb-api-explorer'));
  });

  test('POST /boards/@test/simple.api/invoke should invoke API', { concurrency: false }, async () => {
    const inputData = {
      text: 'Hello, API!',
      $key: account.api_key
    };

    const { statusCode, data: body } = await makeRequest({
      path: '/boards/@test/simple.api/invoke',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: inputData
    });

    assert.strictEqual(statusCode, 200);
    
    const response = JSON.parse(body);

    // Check if the response contains the expected output
    assert(response.text, 'Response should contain output');
    assert.strictEqual(response.text, 'Hello, API!', 'Output should echo the input');
  });

  test('POST /boards/@test/simple.api/describe should serve API description', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: '/boards/@test/simple.api/describe',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('Describe response:', statusCode, body);

    assert.strictEqual(statusCode, 200);
    
    const response = JSON.parse(body);
    
    // Check if the response contains the expected properties
    assert(response.title, 'Response should contain a title');
    assert(response.inputSchema, 'Response should contain an inputSchema');
    assert(response.outputSchema, 'Response should contain an outputSchema');
    
    // Check if the $key input has been added
    assert(response.inputSchema.properties.$key, 'InputSchema should contain a $key property');
    assert(response.inputSchema.required.includes('$key'), 'InputSchema should require $key');
    
    assert.strictEqual(response.title, 'simple', 'Title should match the simple board');

  });

  test('POST /boards/@test/simple.api/run should execute the board', { concurrency: false }, async () => {
    const inputData = {
      text: 'Hello, API!',
      $key: account.api_key
    };

    const { statusCode, data: body } = await makeRequest({
      path: '/boards/@test/simple.api/run',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: inputData
    });

    assert.strictEqual(statusCode, 200);
    
    // The response is a stream of events, so we need to parse each event
    const events = body.split('\n\n').filter(Boolean).map(event => {
      const jsonStr = event.replace('data: ', '');
      return JSON.parse(jsonStr);
    });

    // Check if there's at least one event
    assert(events.length > 0, 'Response should include at least one event');

    // Check the final output
    const outputEvent = events.find(event => event[0] === 'output');
    assert(outputEvent, 'Response should include an output event');
    assert.deepStrictEqual(outputEvent[1].outputs, { text: 'Hello, API!' }, 'Output should echo the input');
  });

  test('GET /boards/@test/simple.invite should list invites', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: `/boards/@${account.account}/simple.invite?API_KEY=${account.api_key}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(statusCode, 200);
    const response = JSON.parse(body);
    assert(Array.isArray(response.invites), 'Response should contain an array of invites');
  });

  test('POST /boards/@test/simple.invite should create a new invite', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: `/boards/@${account.account}/simple.invite?API_KEY=${account.api_key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(statusCode, 200);
    const response = JSON.parse(body);
    assert(response.invite, 'Response should contain a new invite code');
  });

  test('POST /boards/@test/simple.invite should delete an invite', { concurrency: false }, async () => {
    // First, create an invite
    const { data: createBody } = await makeRequest({
      path: `/boards/@${account.account}/simple.invite?API_KEY=${account.api_key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const createResponse = JSON.parse(createBody);
    const inviteToDelete = createResponse.invite;

    // Now, delete the invite
    const { statusCode, data: deleteBody } = await makeRequest({
      path: `/boards/@${account.account}/simple.invite?API_KEY=${account.api_key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { delete: inviteToDelete }
    });
    assert.strictEqual(statusCode, 200);
    const deleteResponse = JSON.parse(deleteBody);
    assert.strictEqual(deleteResponse.deleted, inviteToDelete, 'Response should confirm the deleted invite');
  });

  test('POST /boards/@test/simple.invite should fail to delete non-existent invite', { concurrency: false }, async () => {
    const { statusCode, data: body } = await makeRequest({
      path: `/boards/@${account.account}/simple.invite?API_KEY=${account.api_key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { delete: 'non-existent-invite' }
    });
    assert.strictEqual(statusCode, 200); // The API currently returns 200 even for failures
    const response = JSON.parse(body);
    assert(response.error, 'Response should contain an error message');
  });

})