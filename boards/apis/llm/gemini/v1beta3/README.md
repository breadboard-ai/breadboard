# Gemini API

This is a set of boards that demonstrate how to use the Gemini API.

## embedText

### Running the Board

### Inputs

- `string` - The string that represents a JSON object

### Outputs

If splat: false

- `json` - The JSON object that was represented by the string

If splat: true, the root properties of the JSON object will be available as outputs.

### From the CLI

```bash
breadboard run boards/apis/llms/gemini/v1beta3/generativelanguage.models.embedText.js -i "{\"string\":\"{\\\"a\\\": [1,2,3,4]}\"}" --kit @google-labs/llm-starter --kit @google-labs/core-kit
```

The result will be on the `json` property of the output.

You can also splat the results to the output, so the root properties of the object can be accessed directly from a board.

```bash
breadboard run boards/apis/llms/gemini/v1beta3/generativelanguage.models.embedText.js -i "{\"string\":\"{\\\"a\\\": [1,2,3,4]}\",\"splat\":
true}" --kit @google-labs/llm-starter --kit @google-labs/core-kit
```

### From the UI

```bash
breadboard debug boards/apis/llms/gemini/v1beta3/generativelanguage.models.embedText.js
```

## Recipe for standard implementation generate text and generate embedding

`npx breadboard run generateCompletion.js --kit=@google-labs/core-kit --input-file=tests/general-generateCompletionRequest.json --input="{\"key\":\"$GEMINI_API_KEY\"}"``

## Generate the API from an OpenAPI spec

To generate the API board for Gemini, run the following command from the root of the project:

```bash
npx breadboard import openapi.yaml -o /api
```

Note: Google doesn't support OpenAPI, so the `openapi.yaml` is generated indirectly from the following tool: https://github.com/stackql/google-discovery-to-openapi.

Note 2: Open API doesn't support `Bearer` tokens, so uses the `key` input to pass the API key.
