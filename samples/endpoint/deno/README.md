# Using board server endpoint API with Deno

This example calls board server [run](https://breadboard-ai.github.io/breadboard/docs/reference/board-run-api-endpoint/#run-api-endpoint) endpoint using [Deno](https://deno.com/).

This example calls a simple [chat bot board](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@AgileChicken/chat-with-your-cat.bgl.json) that initiates conversation with the user as the first turn, and then yields for reply, proceeding to the next turn of the conversation when reply is received.

The expected input that the board expects is shaped as a single [LLM Content](https://ai.google.dev/api/caching#Content) port with id `text`:

```json
{
  "text": { "parts": [{ "text": "USER REPLY" }] }
}
```

The board output is shaped as a single conversation context (array of [LLM Content](https://ai.google.dev/api/caching#Content)) port named `output`, and will contain the entire conversation history so far. You can look for the last item in the conversation context to find the latest reply, or render the entire history.

```json
{
  "output": [{ "parts": [{ "text": "LAST CHAT BOT RESPONSE" }] }]
}
```

To use this sample as a starting point, run [degit](https://github.com/Rich-Harris/degit) in a new directory:

```bash
npx degit breadboard-ai/breadboard/samples/endpoint/deno
```

To try the sample, first create a `.env` file in this directory and populate it with your Board Server API Key:

```bash
BOARD_SERVER_API_KEY=YOUR_KEY_GOES_HERE
```

Then run:

```bash
deno index.ts
```

> [!NOTE]
> These instructions assume that you have [Deno](https://deno.com/) already installed.
