```
npx breadboard import https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml -o boards/apis/llm/openai/
```

```
npx breadboard run boards/apis/llm/openai/createCompletion.json --kit @google-labs/core-kit --input-file boards/apis/llm/openai/tests/createCompletionReqeust.json
```
