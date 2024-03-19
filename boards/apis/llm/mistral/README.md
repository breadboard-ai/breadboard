To generate the API board for Mistral, run the following command from the root of the project:

```bash
npx breadboard import openapi.yaml -o boards/apis/llm/mistral/
```

## Run

```bash
npx breadboard run createCompletion.js --kit=@google-labs/core-kit --input-file=./tests/createChatCompletionRequest.json
```
