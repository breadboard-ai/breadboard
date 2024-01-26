# Gemini API

This is a set of recipes that demonstrate how to use the Gemini API.

## embedText

### Running the Recipe

### Inputs

- `string` - The string that represents a JSON object

### Outputs

If splat: false

- `json` - The JSON object that was represented by the string

If splat: true, the root properties of the JSON object will be available as outputs.

### From the CLI

```bash
breadboard run recipes/apis/llms/gemini/v1beta3/generativelanguage.models.embedText.js -i "{\"string\":\"{\\\"a\\\": [1,2,3,4]}\"}" --kit @google-labs/llm-starter --kit @google-labs/core-kit
```

The result will be on the `json` property of the output.

You can also splat the results to the output, so the root properties of the object can be accessed directly from a board.

```bash
breadboard run recipes/apis/llms/gemini/v1beta3/generativelanguage.models.embedText.js -i "{\"string\":\"{\\\"a\\\": [1,2,3,4]}\",\"splat\":
true}" --kit @google-labs/llm-starter --kit @google-labs/core-kit
```

### From the UI

```bash
breadboard debug recipes/apis/llms/gemini/v1beta3/generativelanguage.models.embedText.js
```

```

```
