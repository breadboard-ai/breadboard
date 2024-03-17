## Update the API to the latest version of OpenAPI (or the latest implementation of breadboard)

```bash
npx breadboard import https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml -o boards/apis/llm/openai/api
```

## Call the API

### Create Completion

```
npx breadboard run boards/apis/llm/openai/createCompletion.json --kit @google-labs/core-kit --input-file boards/apis/llm/openai/tests/createCompletionRequest.json
```
