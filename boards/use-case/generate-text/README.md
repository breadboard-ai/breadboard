# Generate Text

This board demonstrates how to generate a text based on a prompt.

## Running the Board

### Inputs

- `prompt` - The prompt that you want to generate text from
- `provider` - The path to the board that will provide access to the LLM API that will be used to generate the text.

### Secrets

This board requires will request the secrets based on the board that you are using to talk to the llm. For example, the OpenAI board will require the `OPENAI_API_KEY` secret.

### Outputs

- `text` - The text response from the LLM.

### From the CLI

```bash
breadboard run boards/use-case/generate-text/index.js --kit @google-labs/core-kit --kit --input-file generateTextReqeust.json"
```

### From the UI

```bash
breadboard debug boards/use-case/generate-text/index.js
```

## Code

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
invoke5["invoke <br> id='invoke-5'"] -- "embedding->embedding" --> embedding_result{{"output <br> id='embedding_result'"}}:::output
input[/"input <br> id='input'"/]:::input -- all --> fn4["invoke <br> id='fn-4'"]
input[/"input <br> id='input'"/]:::input -- "input->input" --> invoke5["invoke <br> id='invoke-5'"]
fn4["invoke <br> id='fn-4'"] -- all --> invoke5["invoke <br> id='invoke-5'"]

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
