# Using board server endpoint API from the browser

This example calls board server [run](https://breadboard-ai.github.io/breadboard/docs/reference/board-run-api-endpoint/#run-api-endpoint) endpoint directly from the browser.

This example calls a simple [chat bot board](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@AgileChicken/chat-with-your-cat.bgl.json) that initiates conversation with the user as the first turn, and then yields for reply, proceeding to the next turn of the conversation when reply is received.

The expected input that the board expects is shaped as a single [LLM Content](https://ai.google.dev/api/caching#Content) port with id `text`:

```json
{
  "text": { "parts": [{ "text": "USER REPLY" }] }
}
```

The board output is shaped as a single conversation context (array of [LLM Content](https://ai.google.dev/api/caching#Content)) port named `output`:

```json
{
  "output": [{ "parts": [{ "text": "CHAT BOT RESPONSE" }] }]
}
```

To use this sample as a starting point, run [degit](https://github.com/Rich-Harris/degit) in a new directory:

```bash
npx degit breadboard-ai/breadboard/samples/endpoint/browser
```

To try the sample, start a simple HTTP server in that directory:

```bash
npx http-server
```

Then go to the URL provided by the server.

> [!NOTE]
> These instructions assume that you have [node](https://nodejs.org/) already installed.
