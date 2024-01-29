# Few Shot

This board demonstrates how to integrate few shot learning into a Breadboard using the PaLM API. While this can be done easily with a normal prompt, this board has two inputs: `few` and `prompt. This lets you more easily pull the two bits of data from two different sources

## Running the Board

### Inputs

- `few` - An array of strings as examples.
- `promptText` - The prompt to use for the few shot learning.

### Secrets

This board requires the following secrets to be set to be exported as environment variables:

- `PALM_KEY` - The key for the PaLM API.

### Outputs

- `response` - The result from the prompt.

### From the CLI

```bash
breadboard run boards/llm-concepts/few-shot/index.js --kit @google-labs/llm-starter --kit @google-labs/palm-kit -i "{\"few\": [\"Great product, 10/10: positive\", \"Didn't work very well: negative\", \"Super helpful, worth it: positive\"], \"promptText\": \"This is great:\" }" --kit @google-labs/llm-starter --kit @google-labs/core-kit --kit @google-labs/palm-kit
```

### From the UI

```bash
breadboard debug boards/llm-concepts/few-shot/index.js
```

## Code

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
palmgenerateText6["palm-generateText <br> id='palm-generateText-6'"] -- "response->response" --> fewShotOutput{{"output <br> id='fewShotOutput'"}}:::output
secrets3("secrets <br> id='secrets-3'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText6["palm-generateText <br> id='palm-generateText-6'"]
promptTemplate5["promptTemplate <br> id='promptTemplate-5'"] -- "prompt->text" --> palmgenerateText6["palm-generateText <br> id='palm-generateText-6'"]
fn4["invoke <br> id='fn-4'"] -- "few->few" --> promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]
input[/"input <br> id='input'"/]:::input -- all --> fn4["invoke <br> id='fn-4'"]
input[/"input <br> id='input'"/]:::input -- "promptText->promptText" --> promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]

subgraph sg_fn4 [fn-4]
fn4_fn4input[/"input <br> id='fn-4-input'"/]:::input -- all --> fn4_fn4run["runJavascript <br> id='fn-4-run'"]
fn4_fn4run["runJavascript <br> id='fn-4-run'"] -- all --> fn4_fn4output{{"output <br> id='fn-4-output'"}}:::output
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
