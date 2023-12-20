## openai-gpt-4-vision.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
streamTransform["transformStream <br> id='streamTransform'"] -- all --> streamOutput{{"output <br> id='streamOutput'"}}:::output
subgraph sg_streamTransform [streamTransform]
streamTransform_transformCompletion["jsonata <br> id='transformCompletion'"] -- "result->chunk" --> streamTransform_result{{"output <br> id='result'"}}:::output
streamTransform_chunk[/"input <br> id='chunk'"/]:::input -- "chunk->json" --> streamTransform_transformCompletion["jsonata <br> id='transformCompletion'"]
end
sg_streamTransform:::slotted -- "lamdba->lamdba" --o streamTransform

openai["fetch <br> id='openai'"] -- "response->json" --> getResponse["jsonata <br> id='getResponse'"]
openai["fetch <br> id='openai'"] -- "stream->stream" --> streamTransform["transformStream <br> id='streamTransform'"]
input[/"input <br> id='input'"/]:::input -- all --> makeBody["jsonata <br> id='makeBody'"]
input[/"input <br> id='input'"/]:::input -- "useStreaming->stream" --> openai["fetch <br> id='openai'"]
makeHeaders["jsonata <br> id='makeHeaders'"] -- "result->headers" --> openai["fetch <br> id='openai'"]
makeBody["jsonata <br> id='makeBody'"] -- "result->body" --> openai["fetch <br> id='openai'"]
getResponse["jsonata <br> id='getResponse'"] -- "result->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
secrets3("secrets <br> id='secrets-3'"):::secrets -- "OPENAI_API_KEY->OPENAI_API_KEY" --> makeHeaders["jsonata <br> id='makeHeaders'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```