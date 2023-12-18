## text-generator.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
mock["invoke <br> id='mock'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
mock["invoke <br> id='mock'"] -- "stream->stream" --> streamOutput{{"output <br> id='streamOutput'"}}:::output
gemini["invoke <br> id='gemini'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
gemini["invoke <br> id='gemini'"] -- "stream->stream" --> streamOutput{{"output <br> id='streamOutput'"}}:::output
palmGenerator["invoke <br> id='palmGenerator'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
palmGenerator["invoke <br> id='palmGenerator'"] -- "stream->stream" --> streamOutput{{"output <br> id='streamOutput'"}}:::output
gpt35["invoke <br> id='gpt35'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
gpt35["invoke <br> id='gpt35'"] -- "stream->stream" --> streamOutput{{"output <br> id='streamOutput'"}}:::output
fn3["invoke <br> id='fn-3'"] -- "mock->choose" --> mock["invoke <br> id='mock'"]
fn3["invoke <br> id='fn-3'"] -- "gemini->choose" --> gemini["invoke <br> id='gemini'"]
fn3["invoke <br> id='fn-3'"] -- "palm->choose" --> palmGenerator["invoke <br> id='palmGenerator'"]
fn3["invoke <br> id='fn-3'"] -- "gpt35->choose" --> gpt35["invoke <br> id='gpt35'"]
input[/"input <br> id='input'"/]:::input -- "MODEL->MODEL" --> fn3["invoke <br> id='fn-3'"]
input[/"input <br> id='input'"/]:::input -- all --> mock["invoke <br> id='mock'"]
input[/"input <br> id='input'"/]:::input -- all --> gemini["invoke <br> id='gemini'"]
input[/"input <br> id='input'"/]:::input -- all --> palmGenerator["invoke <br> id='palmGenerator'"]
input[/"input <br> id='input'"/]:::input -- all --> gpt35["invoke <br> id='gpt35'"]

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