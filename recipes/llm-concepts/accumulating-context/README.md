# Accumulating Context

An example of a board that implements a multi-turn experience: a very simple chat bot that accumulates context of the conversations. Tell it "I am hungry" or something like this and then give simple replies, like "bbq". It should be able to infer what you're asking for based on the conversation context. All replies are pure hallucinations, but should give you a sense of how a Breadboard API endpoint for a board with cycles looks like.

## Running the Recipe

### Inputs

- `parameters` - The URL of a graph that will respond the context of the conversation.
- `userRequest` - A string that contains the users conversation.

Depending on the Text Generator you use, you may need to provide additional inputs such as `PALM_KEY`.

### Outputs

- TBD

### From the CLI

An example using an external board to interact with PaLM

```bash
breadboard run recipes/llm-concepts/accumulating-context/index.js --kit @google-labs/core-kit --kit @google-labs/llm-starter --kit @google-labs/palm-kit
```

When prompted for the Text generator to use, enter `./packages/breadboard-web/dist/graphs/text-generator.json`. If you use this graph, you also have to set an environment variable `PALM_KEY` to the API key for PaLM.

When prompted "Type here to chat with the assistant", type anything you want like `Hello`

The Text generator listed above will then ask "The model to use for generation", enter `PaLM`

### From the UI

```bash
breadboard debug recipes/use-case/fetch-rss/index.js
```

## Mermaid

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
userRequest[/"input <br> id='userRequest'"/]:::input -- "text->question" --> assistant["promptTemplate <br> id='assistant'"]
userRequest[/"input <br> id='userRequest'"/]:::input -- "text->user" --> append1["append <br> id='append-1'"]
parameters[/"input <br> id='parameters'"/]:::input --> userRequest[/"input <br> id='userRequest'"/]:::input
parameters[/"input <br> id='parameters'"/]:::input -- "generator->path" --o generator["invoke <br> id='generator'"]
output2{{"output <br> id='output-2'"}}:::output --> userRequest[/"input <br> id='userRequest'"/]:::input
assistant["promptTemplate <br> id='assistant'"] -- "prompt->text" --> generator["invoke <br> id='generator'"]
append1["append <br> id='append-1'"] -- "accumulator->accumulator" --> append1["append <br> id='append-1'"]
append1["append <br> id='append-1'"] -- "accumulator->context" --> assistant["promptTemplate <br> id='assistant'"]
generator["invoke <br> id='generator'"] -- "text->assistant" --> append1["append <br> id='append-1'"]
generator["invoke <br> id='generator'"] -- "text->text" --> output2{{"output <br> id='output-2'"}}:::output
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```
