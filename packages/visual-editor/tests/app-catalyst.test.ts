import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert";
import { AppCatalystApiClient } from "../src/ui/flow-gen/app-catalyst.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../src/ui/config/client-deployment-configuration.js";

describe("AppCatalystApiClient", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("should construct correct URL and headers for getG1SubscriptionStatus", async () => {
    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({ is_member: true, remaining_credits: 10 }),
          { status: 200 }
        );
      }
    );

    const client = new AppCatalystApiClient(
      fetchMock as any,
      "https://api.example.com",
      {} as any
    );
    await client.getG1SubscriptionStatus({ include_credit_data: true });

    assert.strictEqual(fetchMock.mock.calls.length, 1);
    const [url, init] = fetchMock.mock.calls[0].arguments;

    assert.strictEqual(
      url.toString(),
      "https://api.example.com/v1beta1/getG1SubscriptionStatus"
    );
    assert.strictEqual(init?.method, "POST");
    assert.deepStrictEqual(init?.headers, {
      "content-type": "application/json",
    });
    assert.strictEqual(
      init?.body,
      JSON.stringify({ include_credit_data: true })
    );
  });

  it("should construct correct URL and headers for getG1Credits", async () => {
    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response(JSON.stringify({ remaining_credits: 5 }), {
          status: 200,
        });
      }
    );

    const client = new AppCatalystApiClient(
      fetchMock as any,
      "https://api.example.com",
      {} as any
    );
    await client.getG1Credits();

    assert.strictEqual(fetchMock.mock.calls.length, 1);
    const [url, init] = fetchMock.mock.calls[0].arguments;

    assert.strictEqual(
      url.toString(),
      "https://api.example.com/v1beta1/getG1Credits"
    );
    assert.strictEqual(init?.method, "POST");
    assert.deepStrictEqual(init?.headers, {
      "content-type": "application/json",
    });
    assert.strictEqual(init?.body, "{}");
  });

  describe("checkTos", () => {
    it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
      // Ensure the flag is off (default in test environment).
      const saved = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = false;

      const fetchMock = mock.fn(
        async (_url: URL | RequestInfo, _init?: RequestInit) => {
          return new Response(
            JSON.stringify({
              canAccess: true,
              accessStatus: "ACCESS_STATUS_OK",
            }),
            { status: 200 }
          );
        }
      );

      const backendClientMock = {
        sendHttpRequest: mock.fn(async () => new Response("{}")),
      };

      const client = new AppCatalystApiClient(
        fetchMock as any,
        "https://api.example.com",
        Promise.resolve(backendClientMock)
      );

      const result = await client.checkTos();

      // fetchWithCreds was called, sendHttpRequest was not.
      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(backendClientMock.sendHttpRequest.mock.calls.length, 0);

      // Correct URL was constructed.
      const [url] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(
        url.toString(),
        "https://api.example.com/v1beta1/checkAppAccess"
      );

      // Response parsed correctly.
      assert.strictEqual(result.canAccess, true);
      assert.strictEqual(result.accessStatus, "ACCESS_STATUS_OK");

      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = saved;
    });

    it("uses invokeOpalBackend when ENABLE_BACKEND_CLIENT is on", async () => {
      // Enable the flag.
      const saved = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

      const fetchMock = mock.fn(
        async (_url: URL | RequestInfo, _init?: RequestInit) => {
          return new Response("{}", { status: 200 });
        }
      );

      const backendClientMock = {
        sendHttpRequest: mock.fn(async () => {
          return new Response(
            JSON.stringify({
              canAccess: true,
              accessStatus: "ACCESS_STATUS_OK",
            }),
            { status: 200 }
          );
        }),
      };

      const client = new AppCatalystApiClient(
        fetchMock as any,
        "https://api.example.com",
        Promise.resolve(backendClientMock)
      );

      const result = await client.checkTos();

      // sendHttpRequest was called, fetchWithCreds was not.
      assert.strictEqual(backendClientMock.sendHttpRequest.mock.calls.length, 1);
      assert.strictEqual(fetchMock.mock.calls.length, 0);

      // Correct RPC endpoint and options were passed.
      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, unknown];
      assert.strictEqual(methodName, "checkAppAccess");
      assert.deepStrictEqual(options, { method: "GET" });

      // Response parsed correctly.
      assert.strictEqual(result.canAccess, true);
      assert.strictEqual(result.accessStatus, "ACCESS_STATUS_OK");

      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = saved;
    });

    it("overrides canAccess when accessStatus is not ACCESS_STATUS_OK", async () => {
      const saved = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

      const backendClientMock = {
        sendHttpRequest: mock.fn(async () => {
          return new Response(
            JSON.stringify({
              canAccess: true,
              accessStatus: "ACCESS_STATUS_TOS_NOT_ACCEPTED",
              termsOfService: { version: 1, terms: "Please accept." },
            }),
            { status: 200 }
          );
        }),
      };

      const client = new AppCatalystApiClient(
        (() => {}) as any,
        "https://api.example.com",
        Promise.resolve(backendClientMock)
      );

      const result = await client.checkTos();

      // canAccess should be forced to false by the override logic.
      assert.strictEqual(result.canAccess, false);
      assert.strictEqual(result.accessStatus, "ACCESS_STATUS_TOS_NOT_ACCEPTED");

      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = saved;
    });

    it("returns fallback on network error", async () => {
      const saved = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

      const backendClientMock = {
        sendHttpRequest: mock.fn(async () => {
          throw new Error("network failure");
        }),
      };

      const client = new AppCatalystApiClient(
        (() => {}) as any,
        "https://api.example.com",
        Promise.resolve(backendClientMock)
      );

      const result = await client.checkTos();

      assert.strictEqual(result.canAccess, false);
      assert.strictEqual(result.accessStatus, "Unable to check");

      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = saved;
    });
  });
});
