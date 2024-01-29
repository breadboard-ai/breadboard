```
npx breadboard import https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml -o recipes/apis/llm/openai/
```

```
npx breadboard run recipes/apis/llm/openai/createCompletion.json --kit @google-labs/core-kit --input-file recipes/apis/llm/openai/tests/createCompletionReqeust.json
```
