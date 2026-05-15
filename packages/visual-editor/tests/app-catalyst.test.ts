import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert";
import {
  AppCatalystApiClient,
  NotifyPreference,
} from "../src/ui/flow-gen/app-catalyst.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../src/ui/config/client-deployment-configuration.js";

describe("AppCatalystApiClient", () => {
  let savedFlag: boolean;

  afterEach(() => {
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = savedFlag;
    mock.restoreAll();
  });

  function setup(flagOn: boolean) {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = flagOn;

    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response("{}", { status: 200 });
      }
    );

    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => new Response("{}", { status: 200 })),
    };

    const client = new AppCatalystApiClient(
      fetchMock as any,
      "https://api.example.com",
      Promise.resolve(backendClientMock)
    );

    return { client, fetchMock, backendClientMock };
  }

  // ---- getG1SubscriptionStatus ----

  describe("getG1SubscriptionStatus", () => {
    it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
      const { client, fetchMock, backendClientMock } = setup(false);

      const responseBody = { isMember: true, remainingCredits: 10 };
      fetchMock.mock.mockImplementation(
        async () => new Response(JSON.stringify(responseBody), { status: 200 })
      );

      const result = await client.getG1SubscriptionStatus({
        include_credit_data: true,
      });

      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        0
      );

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

      assert.strictEqual(result.isMember, true);
      assert.strictEqual(result.remainingCredits, 10);
    });

    it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
      const { client, fetchMock, backendClientMock } = setup(true);

      const responseBody = { isMember: false, remainingCredits: 0 };
      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () => new Response(JSON.stringify(responseBody), { status: 200 })
      );

      const result = await client.getG1SubscriptionStatus({
        include_credit_data: true,
      });

      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        1
      );
      assert.strictEqual(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, unknown];
      assert.strictEqual(methodName, "getG1SubscriptionStatus");
      assert.deepStrictEqual(options, {
        method: "POST",
        body: { include_credit_data: true },
      });

      assert.strictEqual(result.isMember, false);
      assert.strictEqual(result.remainingCredits, 0);
    });

    it("throws on non-ok response (flag off)", async () => {
      const { client, fetchMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () =>
          new Response("", { status: 500, statusText: "Internal Server Error" })
      );

      await assert.rejects(
        () => client.getG1SubscriptionStatus({ include_credit_data: false }),
        (err: Error) => {
          assert.match(err.message, /Failed to get G1 subscription status/);
          return true;
        }
      );
    });

    it("throws on non-ok response (flag on)", async () => {
      const { client, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () =>
          new Response("", { status: 500, statusText: "Internal Server Error" })
      );

      await assert.rejects(
        () => client.getG1SubscriptionStatus({ include_credit_data: false }),
        (err: Error) => {
          assert.match(err.message, /Failed to get G1 subscription status/);
          return true;
        }
      );
    });
  });

  // ---- getG1Credits ----

  describe("getG1Credits", () => {
    it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
      const { client, fetchMock, backendClientMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () =>
          new Response(JSON.stringify({ remainingCredits: 5 }), { status: 200 })
      );

      const result = await client.getG1Credits();

      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        0
      );

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

      assert.strictEqual(result.remainingCredits, 5);
    });

    it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
      const { client, fetchMock, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () =>
          new Response(JSON.stringify({ remainingCredits: 42 }), {
            status: 200,
          })
      );

      const result = await client.getG1Credits();

      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        1
      );
      assert.strictEqual(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, unknown];
      assert.strictEqual(methodName, "getG1Credits");
      assert.deepStrictEqual(options, {
        method: "POST",
        body: {},
      });

      assert.strictEqual(result.remainingCredits, 42);
    });

    it("throws on non-ok response (flag off)", async () => {
      const { client, fetchMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () =>
          new Response("", { status: 503, statusText: "Service Unavailable" })
      );

      await assert.rejects(
        () => client.getG1Credits(),
        (err: Error) => {
          assert.match(err.message, /Failed to get G1 credits/);
          return true;
        }
      );
    });

    it("throws on non-ok response (flag on)", async () => {
      const { client, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () =>
          new Response("", { status: 503, statusText: "Service Unavailable" })
      );

      await assert.rejects(
        () => client.getG1Credits(),
        (err: Error) => {
          assert.match(err.message, /Failed to get G1 credits/);
          return true;
        }
      );
    });
  });

  // ---- chat (chatGenerateApp) ----

  describe("chat", () => {
    const chatRequest = {
      messages: [{ mimetype: "text/plain" as const, data: "hello" }],
      appOptions: { format: "FORMAT_GEMINI_FLOWS" as const },
    };

    it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
      const { client, fetchMock, backendClientMock } = setup(false);

      const responseBody = {
        messages: [{ mimetype: "text/plain", data: "hi" }],
      };
      fetchMock.mock.mockImplementation(
        async () => new Response(JSON.stringify(responseBody), { status: 200 })
      );

      const result = await client.chat(chatRequest);

      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        0
      );

      const [url, init] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(
        url.toString(),
        "https://api.example.com/v1beta1/chatGenerateApp"
      );
      assert.strictEqual(init?.method, "POST");
      assert.deepStrictEqual(init?.headers, {
        "content-type": "application/json",
      });
      assert.strictEqual(init?.body, JSON.stringify(chatRequest));

      assert.deepStrictEqual(result, responseBody);
    });

    it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
      const { client, fetchMock, backendClientMock } = setup(true);

      const responseBody = {
        messages: [{ mimetype: "text/plain", data: "hi" }],
      };
      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () => new Response(JSON.stringify(responseBody), { status: 200 })
      );

      const result = await client.chat(chatRequest);

      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        1
      );
      assert.strictEqual(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, unknown];
      assert.strictEqual(methodName, "chatGenerateApp");
      assert.deepStrictEqual(options, {
        method: "POST",
        body: chatRequest,
      });

      assert.deepStrictEqual(result, responseBody);
    });

    it("parses response even on non-ok status (flag off)", async () => {
      // chat() does not check response.ok — it always parses the JSON.
      // This test documents that existing behavior.
      const { client, fetchMock } = setup(false);

      const responseBody = {
        messages: [{ mimetype: "text/plain", data: "error msg" }],
      };
      fetchMock.mock.mockImplementation(
        async () => new Response(JSON.stringify(responseBody), { status: 400 })
      );

      const result = await client.chat(chatRequest);
      assert.deepStrictEqual(result, responseBody);
    });

    it("parses response even on non-ok status (flag on)", async () => {
      const { client, backendClientMock } = setup(true);

      const responseBody = {
        messages: [{ mimetype: "text/plain", data: "error msg" }],
      };
      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () => new Response(JSON.stringify(responseBody), { status: 400 })
      );

      const result = await client.chat(chatRequest);
      assert.deepStrictEqual(result, responseBody);
    });
  });

  // ---- acceptTos ----

  describe("acceptTos", () => {
    it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
      const { client, fetchMock, backendClientMock } = setup(false);

      await client.acceptTos(2, true);

      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        0
      );

      const [url, init] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(
        url.toString(),
        "https://api.example.com/v1beta1/acceptToS"
      );
      assert.strictEqual(init?.method, "POST");
      assert.deepStrictEqual(init?.headers, {
        "content-type": "application/json",
      });
      assert.strictEqual(
        init?.body,
        JSON.stringify({ termsOfServiceVersion: 2, acceptTos: true })
      );
    });

    it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
      const { client, fetchMock, backendClientMock } = setup(true);

      await client.acceptTos(2, true);

      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        1
      );
      assert.strictEqual(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, unknown];
      assert.strictEqual(methodName, "acceptToS");
      assert.deepStrictEqual(options, {
        method: "POST",
        body: { termsOfServiceVersion: 2, acceptTos: true },
      });
    });

    it("uses default params (tosVersion=1, acceptTos=false)", async () => {
      const { client, fetchMock } = setup(false);

      await client.acceptTos();

      const [, init] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(
        init?.body,
        JSON.stringify({ termsOfServiceVersion: 1, acceptTos: false })
      );
    });

    it("uses default params via sendHttpRequest", async () => {
      const { client, backendClientMock } = setup(true);

      await client.acceptTos();

      const [, options] = backendClientMock.sendHttpRequest.mock.calls[0]
        .arguments as unknown as [string, unknown];
      assert.deepStrictEqual(options, {
        method: "POST",
        body: { termsOfServiceVersion: 1, acceptTos: false },
      });
    });

    it("throws on non-ok response (flag off)", async () => {
      const { client, fetchMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () =>
          new Response("", { status: 500, statusText: "Internal Server Error" })
      );

      await assert.rejects(
        () => client.acceptTos(),
        (err: Error) => {
          assert.match(err.message, /Failed to accept TOS/);
          return true;
        }
      );
    });

    it("throws on non-ok response (flag on)", async () => {
      const { client, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () =>
          new Response("", { status: 500, statusText: "Internal Server Error" })
      );

      await assert.rejects(
        () => client.acceptTos(),
        (err: Error) => {
          assert.match(err.message, /Failed to accept TOS/);
          return true;
        }
      );
    });
  });

  // ---- fetchEmailPreferences ----

  describe("fetchEmailPreferences", () => {
    const preferenceKeys = ["key_a", "key_b"] as const;

    const backendResponse = {
      preferenceResponses: [
        {
          preferenceKey: "key_a",
          notifyPreference: NotifyPreference.NOTIFY,
          hasStoredPreference: true,
        },
        {
          preferenceKey: "key_b",
          notifyPreference: NotifyPreference.DROP,
          hasStoredPreference: true,
        },
      ],
    };

    it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
      const { client, fetchMock, backendClientMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () =>
          new Response(JSON.stringify(backendResponse), { status: 200 })
      );

      const result = await client.fetchEmailPreferences(preferenceKeys);

      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        0
      );

      const [url, init] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(
        url.toString(),
        "https://api.example.com/v1beta1/getEmailPreferences"
      );
      assert.strictEqual(init?.method, "POST");
      assert.deepStrictEqual(init?.headers, {
        "content-type": "application/json",
      });
      assert.strictEqual(
        init?.body,
        JSON.stringify({ preferenceKeys: ["key_a", "key_b"] })
      );

      assert.strictEqual(result.hasStoredPreferences, true);
      assert.deepStrictEqual(result.preferences, [
        ["key_a", true],
        ["key_b", false],
      ]);
    });

    it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
      const { client, fetchMock, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () =>
          new Response(JSON.stringify(backendResponse), { status: 200 })
      );

      const result = await client.fetchEmailPreferences(preferenceKeys);

      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        1
      );
      assert.strictEqual(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, unknown];
      assert.strictEqual(methodName, "getEmailPreferences");
      assert.deepStrictEqual(options, {
        method: "POST",
        body: { preferenceKeys },
      });

      assert.strictEqual(result.hasStoredPreferences, true);
      assert.deepStrictEqual(result.preferences, [
        ["key_a", true],
        ["key_b", false],
      ]);
    });

    it("returns empty defaults when preferenceResponses is missing", async () => {
      const { client, fetchMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () => new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await client.fetchEmailPreferences(preferenceKeys);

      assert.strictEqual(result.hasStoredPreferences, false);
      assert.deepStrictEqual(result.preferences, []);
    });

    it("returns empty defaults when preferenceResponses is missing (flag on)", async () => {
      const { client, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () => new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await client.fetchEmailPreferences(preferenceKeys);

      assert.strictEqual(result.hasStoredPreferences, false);
      assert.deepStrictEqual(result.preferences, []);
    });

    it("hasStoredPreferences is false when no prefs are stored", async () => {
      const { client, fetchMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              preferenceResponses: [
                {
                  preferenceKey: "key_a",
                  notifyPreference: NotifyPreference.NOTIFY,
                  hasStoredPreference: false,
                },
              ],
            }),
            { status: 200 }
          )
      );

      const result = await client.fetchEmailPreferences(preferenceKeys);

      assert.strictEqual(result.hasStoredPreferences, false);
    });

    it("throws on non-ok response (flag off)", async () => {
      const { client, fetchMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () =>
          new Response("", { status: 500, statusText: "Internal Server Error" })
      );

      await assert.rejects(
        () => client.fetchEmailPreferences(preferenceKeys),
        (err: Error) => {
          assert.match(err.message, /Failed to fetch email preferences/);
          return true;
        }
      );
    });

    it("throws on non-ok response (flag on)", async () => {
      const { client, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () =>
          new Response("", { status: 500, statusText: "Internal Server Error" })
      );

      await assert.rejects(
        () => client.fetchEmailPreferences(preferenceKeys),
        (err: Error) => {
          assert.match(err.message, /Failed to fetch email preferences/);
          return true;
        }
      );
    });
  });

  // ---- setEmailPreferences ----

  describe("setEmailPreferences", () => {
    const prefs: Array<[string, boolean]> = [
      ["key_a", true],
      ["key_b", false],
    ];

    const expectedBody = {
      preferenceEntries: [
        {
          preferenceKey: "key_a",
          notifyPreference: NotifyPreference.NOTIFY,
        },
        {
          preferenceKey: "key_b",
          notifyPreference: NotifyPreference.DROP,
        },
      ],
    };

    it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
      const { client, fetchMock, backendClientMock } = setup(false);

      await client.setEmailPreferences(prefs);

      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        0
      );

      const [url, init] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(
        url.toString(),
        "https://api.example.com/v1beta1/setEmailPreferences"
      );
      assert.strictEqual(init?.method, "POST");
      assert.deepStrictEqual(init?.headers, {
        "content-type": "application/json",
      });
      assert.deepStrictEqual(JSON.parse(init?.body as string), expectedBody);
    });

    it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
      const { client, fetchMock, backendClientMock } = setup(true);

      await client.setEmailPreferences(prefs);

      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        1
      );
      assert.strictEqual(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, Record<string, unknown>];
      assert.strictEqual(methodName, "setEmailPreferences");
      assert.strictEqual(options.method, "POST");
      assert.deepStrictEqual(options.body, expectedBody);
    });

    it("throws on non-ok response (flag off)", async () => {
      const { client, fetchMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () => new Response("", { status: 403, statusText: "Forbidden" })
      );

      await assert.rejects(
        () => client.setEmailPreferences(prefs),
        (err: Error) => {
          assert.match(err.message, /Failed to set email preferences/);
          return true;
        }
      );
    });

    it("throws on non-ok response (flag on)", async () => {
      const { client, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () => new Response("", { status: 403, statusText: "Forbidden" })
      );

      await assert.rejects(
        () => client.setEmailPreferences(prefs),
        (err: Error) => {
          assert.match(err.message, /Failed to set email preferences/);
          return true;
        }
      );
    });
  });

  // ---- checkTos ----

  describe("checkTos", () => {
    it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
      const { client, fetchMock, backendClientMock } = setup(false);

      fetchMock.mock.mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              canAccess: true,
              accessStatus: "ACCESS_STATUS_OK",
            }),
            { status: 200 }
          )
      );

      const result = await client.checkTos();

      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        0
      );

      const [url] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(
        url.toString(),
        "https://api.example.com/v1beta1/checkAppAccess"
      );

      assert.strictEqual(result.canAccess, true);
      assert.strictEqual(result.accessStatus, "ACCESS_STATUS_OK");
    });

    it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
      const { client, fetchMock, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              canAccess: true,
              accessStatus: "ACCESS_STATUS_OK",
            }),
            { status: 200 }
          )
      );

      const result = await client.checkTos();

      assert.strictEqual(
        backendClientMock.sendHttpRequest.mock.calls.length,
        1
      );
      assert.strictEqual(fetchMock.mock.calls.length, 0);

      const [methodName, options] = backendClientMock.sendHttpRequest.mock
        .calls[0].arguments as unknown as [string, unknown];
      assert.strictEqual(methodName, "checkAppAccess");
      assert.deepStrictEqual(options, { method: "GET" });

      assert.strictEqual(result.canAccess, true);
      assert.strictEqual(result.accessStatus, "ACCESS_STATUS_OK");
    });

    it("overrides canAccess when accessStatus is not ACCESS_STATUS_OK", async () => {
      const { client, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              canAccess: true,
              accessStatus: "ACCESS_STATUS_TOS_NOT_ACCEPTED",
              termsOfService: { version: 1, terms: "Please accept." },
            }),
            { status: 200 }
          )
      );

      const result = await client.checkTos();

      assert.strictEqual(result.canAccess, false);
      assert.strictEqual(result.accessStatus, "ACCESS_STATUS_TOS_NOT_ACCEPTED");
    });

    it("returns fallback on network error", async () => {
      const { client, backendClientMock } = setup(true);

      backendClientMock.sendHttpRequest.mock.mockImplementation(async () => {
        throw new Error("network failure");
      });

      const result = await client.checkTos();

      assert.strictEqual(result.canAccess, false);
      assert.strictEqual(result.accessStatus, "Unable to check");
    });
  });
});
