import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { AppCatalystApiClient } from "../src/ui/flow-gen/app-catalyst.js";

describe("AppCatalystApiClient", () => {
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
      "https://api.example.com"
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
      "https://api.example.com"
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
});
