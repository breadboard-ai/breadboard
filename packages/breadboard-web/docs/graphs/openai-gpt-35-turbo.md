## openai-gpt-35-turbo.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input[/"input <br> id='input'"/]:::input -- all --> formatParameters["jsonata <br> id='formatParameters'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "OPENAI_API_KEY->OPENAI_API_KEY" --> formatParameters["jsonata <br> id='formatParameters'"]
formatParameters["jsonata <br> id='formatParameters'"] -- all --> callOpenAI["fetch <br> id='callOpenAI'"]
formatParameters["jsonata <br> id='formatParameters'"] -- "context->messages" --> getNewContext["jsonata <br> id='getNewContext'"]
lambda2["lambda <br> id='lambda-2'"] -- "board->board" --o transformStream3["transformStream <br> id='transformStream-3'"]
subgraph sg_lambda2 [lambda-2]
lambda2_transformChunk["jsonata <br> id='transformChunk'"] -- "result->chunk" --> lambda2_output2{{"output <br> id='output-2'"}}:::output
lambda2_input1[/"input <br> id='input-1'"/]:::input -- "chunk->json" --> lambda2_transformChunk["jsonata <br> id='transformChunk'"]
end
sg_lambda2:::slotted -- "lamdba->lamdba" --o lambda2

getResponse["jsonata <br> id='getResponse'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
getResponse["jsonata <br> id='getResponse'"] -- "tool_calls->toolCalls" --> toolCallsOutput{{"output <br> id='toolCallsOutput'"}}:::output
callOpenAI["fetch <br> id='callOpenAI'"] -- "response->json" --> getResponse["jsonata <br> id='getResponse'"]
getNewContext["jsonata <br> id='getNewContext'"] -- "result->context" --> textOutput{{"output <br> id='textOutput'"}}:::output
getNewContext["jsonata <br> id='getNewContext'"] -- "result->context" --> toolCallsOutput{{"output <br> id='toolCallsOutput'"}}:::output
callOpenAI["fetch <br> id='callOpenAI'"] -- "response->response" --> getNewContext["jsonata <br> id='getNewContext'"]
transformStream3["transformStream <br> id='transformStream-3'"] -- "stream->stream" --> streamOutput{{"output <br> id='streamOutput'"}}:::output
callOpenAI["fetch <br> id='callOpenAI'"] -- "stream->stream" --> transformStream3["transformStream <br> id='transformStream-3'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```