# Fetch ATOM Feed

This recipe demonstrates how to convert a string to JSON so that it can be used in a Breadboard.

## Running the Recipe

### Inputs

- `string` - The string that represents a JSON object
- `splat` - A boolean that indicates whether or not to use splatting (default: false)

### Outputs

If splat: false

- `json` - The JSON object that was represented by the string

If splat: true, the root properties of the JSON object will be available as outputs.

### From the CLI

```bash
breadboard run recipes/use-case/convert-string-to-json/index.js -i "{\"string\":\"{\\\"a\\\": [1,2,3,4]}\"}" --kit @google-labs/llm-starter --kit @google-labs/core-kit
```

The result will be on the `json` property of the output.

You can also splat the results to the output, so the root properties of the object can be accessed directly from a board.

```bash
breadboard run recipes/use-case/convert-string-to-json/index.js -i "{\"string\":\"{\\\"a\\\": [1,2,3,4]}\",\"splat\":
true}" --kit @google-labs/llm-starter --kit @google-labs/core-kit
```

### From the UI

```bash
breadboard debug recipes/use-case/convert-string-to-json/index.js
```

## Code

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
fn3["invoke <br> id='fn-3'"] -- "json->json" --> json{{"output <br> id='json'"}}:::output
input[/"input <br> id='input'"/]:::input -- "string->string" --> fn3["invoke <br> id='fn-3'"]

subgraph sg_fn3 [fn-3]
fn3_fn3input[/"input <br> id='fn-3-input'"/]:::input -- all --> fn3_fn3run["runJavascript <br> id='fn-3-run'"]
fn3_fn3run["runJavascript <br> id='fn-3-run'"] -- all --> fn3_fn3output{{"output <br> id='fn-3-output'"}}:::output
end

classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```
