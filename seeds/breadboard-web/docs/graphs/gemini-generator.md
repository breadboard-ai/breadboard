## gemini-generator.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
parameters[/"input <br> id='parameters'"/]:::input -- "useStreaming->useStreaming" --> chooseMethod["runJavascript <br> id='chooseMethod'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "GEMINI_KEY->GEMINI_KEY" --> makeURL["urlTemplate <br> id='makeURL'"]
chooseMethod["runJavascript <br> id='chooseMethod'"] -- "method->method" --> makeURL["urlTemplate <br> id='makeURL'"]
chooseMethod["runJavascript <br> id='chooseMethod'"] -- "sseOption->sseOption" --> makeURL["urlTemplate <br> id='makeURL'"]
parameters[/"input <br> id='parameters'"/]:::input -- "useStreaming->stream" --> callGeminiAPI["fetch <br> id='callGeminiAPI'"]
makeURL["urlTemplate <br> id='makeURL'"] -- "url->url" --> callGeminiAPI["fetch <br> id='callGeminiAPI'"]
lambda2["lambda <br> id='lambda-2'"] -- "board->board" --o transformStream3["transformStream <br> id='transformStream-3'"]
subgraph sg_lambda2 [lambda-2]
lambda2_transformChunk["jsonata <br> id='transformChunk'"] -- "result->chunk" --> lambda2_output2{{"output <br> id='output-2'"}}:::output
lambda2_input1[/"input <br> id='input-1'"/]:::input -- "chunk->json" --> lambda2_transformChunk["jsonata <br> id='transformChunk'"]
end
sg_lambda2:::slotted -- "lamdba->lamdba" --o lambda2

formatResponse["jsonata <br> id='formatResponse'"] -- "functionCall->functionCall" --> toolCallsOutput{{"output <br> id='toolCallsOutput'"}}:::output
formatResponse["jsonata <br> id='formatResponse'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
formatResponse["jsonata <br> id='formatResponse'"] -- "context->context" --> textOutput{{"output <br> id='textOutput'"}}:::output
formatResponse["jsonata <br> id='formatResponse'"] -- "context->context" --> toolCallsOutput{{"output <br> id='toolCallsOutput'"}}:::output
parameters[/"input <br> id='parameters'"/]:::input -- "context->context" --> formatResponse["jsonata <br> id='formatResponse'"]
callGeminiAPI["fetch <br> id='callGeminiAPI'"] -- "response->response" --> formatResponse["jsonata <br> id='formatResponse'"]
transformStream3["transformStream <br> id='transformStream-3'"] -- "stream->stream" --> streamOutput{{"output <br> id='streamOutput'"}}:::output
callGeminiAPI["fetch <br> id='callGeminiAPI'"] -- "stream->stream" --> transformStream3["transformStream <br> id='transformStream-3'"]
makeBody["jsonata <br> id='makeBody'"] -- "result->body" --> callGeminiAPI["fetch <br> id='callGeminiAPI'"]
parameters[/"input <br> id='parameters'"/]:::input -- all --> makeBody["jsonata <br> id='makeBody'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```