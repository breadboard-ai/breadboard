## openai-gpt-35-turbo.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
streamTransform["transformStream <br> id='streamTransform'"] -- all --> streamOutput{{"output <br> id='streamOutput'"}}:::output
lambda5["lambda <br> id='lambda-5'"] -- "board->board" --> streamTransform["transformStream <br> id='streamTransform'"]
subgraph sg_lambda5 [lambda-5]
lambda5_transformCompletion["jsonata <br> id='transformCompletion'"] -- "result->chunk" --> lambda5_result{{"output <br> id='result'"}}:::output
lambda5_chunk[/"input <br> id='chunk'"/]:::input -- "chunk->json" --> lambda5_transformCompletion["jsonata <br> id='transformCompletion'"]
end
sg_lambda5:::slotted -- "lamdba->lamdba" --o lambda5

callOpenAI["fetch <br> id='callOpenAI'"] -- "response->json" --> getResponse["jsonata <br> id='getResponse'"]
callOpenAI["fetch <br> id='callOpenAI'"] -- "stream->stream" --> streamTransform["transformStream <br> id='streamTransform'"]
formatParameters["jsonata <br> id='formatParameters'"] -- all --> callOpenAI["fetch <br> id='callOpenAI'"]
formatParameters["jsonata <br> id='formatParameters'"] -- "context->messages" --> getNewContext["jsonata <br> id='getNewContext'"]
getResponse["jsonata <br> id='getResponse'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
getResponse["jsonata <br> id='getResponse'"] -- "tool_calls->toolCalls" --> toolCallsOutput{{"output <br> id='toolCallsOutput'"}}:::output
secrets3("secrets <br> id='secrets-3'"):::secrets -- "OPENAI_API_KEY->OPENAI_API_KEY" --> formatParameters["jsonata <br> id='formatParameters'"]
input[/"input <br> id='input'"/]:::input -- all --> formatParameters["jsonata <br> id='formatParameters'"]
getNewContext["jsonata <br> id='getNewContext'"] -- "result->context" --> textOutput{{"output <br> id='textOutput'"}}:::output
getNewContext["jsonata <br> id='getNewContext'"] -- "result->context" --> toolCallsOutput{{"output <br> id='toolCallsOutput'"}}:::output
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```