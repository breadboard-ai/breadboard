## openai-gpt-4-vision.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets2("secrets <br> id='secrets-2'"):::secrets -- "OPENAI_API_KEY->OPENAI_API_KEY" --> jsonata1["jsonata <br> id='jsonata-1'"]
jsonata1["jsonata <br> id='jsonata-1'"] -- "result->headers" --> fetch4["fetch <br> id='fetch-4'"]
lambda6["lambda <br> id='lambda-6'"] -- "board->board" --o transformStream7["transformStream <br> id='transformStream-7'"]
subgraph sg_lambda6 [lambda-6]
lambda6_jsonata3["jsonata <br> id='jsonata-3'"] -- "result->chunk" --> lambda6_output2{{"output <br> id='output-2'"}}:::output
lambda6_input1[/"input <br> id='input-1'"/]:::input -- "chunk->json" --> lambda6_jsonata3["jsonata <br> id='jsonata-3'"]
end
sg_lambda6:::slotted -- "lamdba->lamdba" --o lambda6

input[/"input <br> id='input'"/]:::input -- "useStreaming->useStreaming" --> jsonata3["jsonata <br> id='jsonata-3'"]
jsonata5["jsonata <br> id='jsonata-5'"] -- "result->text" --> output{{"output <br> id='output'"}}:::output
fetch4["fetch <br> id='fetch-4'"] -- "response->json" --> jsonata5["jsonata <br> id='jsonata-5'"]
transformStream7["transformStream <br> id='transformStream-7'"] -- "stream->stream" --> stream{{"output <br> id='stream'"}}:::output
fetch4["fetch <br> id='fetch-4'"] -- "stream->stream" --> transformStream7["transformStream <br> id='transformStream-7'"]
jsonata3["jsonata <br> id='jsonata-3'"] -- "result->body" --> fetch4["fetch <br> id='fetch-4'"]
input[/"input <br> id='input'"/]:::input -- "content->content" --> jsonata3["jsonata <br> id='jsonata-3'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```