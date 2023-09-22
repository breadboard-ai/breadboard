# pinecone-vector-api
  - Original: [`pinecone-vector-api.ts`](../../src/boards/pinecone-vector-api.ts)
  - Graph: [`pinecone-vector-api.json`](../../graphs/pinecone-vector-api.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PINECONE_API_KEY->json" --> makeheaders["jsonata <br> id='make-headers'"]
makeheaders["jsonata <br> id='make-headers'"] -- "result->headers" --> pineconeapicall["fetch <br> id='pinecone-api-call'"]
secrets2("secrets <br> id='secrets-2'"):::secrets -- "PINECONE_INDEX->PINECONE_INDEX" --> makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
secrets3("secrets <br> id='secrets-3'"):::secrets -- "PINECONE_PROJECT_ID->PINECONE_PROJECT_ID" --> makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
secrets4("secrets <br> id='secrets-4'"):::secrets -- "PINECONE_ENVIRONMENT->PINECONE_ENVIRONMENT" --> makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
api[/"input <br> id='api'"/]:::input -- "call->call" --> makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
makepineconeurl["urlTemplate <br> id='make-pinecone-url'"] -- "url->url" --> pineconeapicall["fetch <br> id='pinecone-api-call'"]
api[/"input <br> id='api'"/]:::input -- "body->body" --> pineconeapicall["fetch <br> id='pinecone-api-call'"]
pineconeapicall["fetch <br> id='pinecone-api-call'"] -- "response->response" --> response{{"output <br> id='response'"}}:::output
schemaapi[schema]:::config -- "schema->schema" --o api
expressionmakeheaders[expression]:::config -- "expression->expression" --o makeheaders
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
rawpineconeapicall[raw]:::config -- "raw->raw" --o pineconeapicall
methodpineconeapicall[method]:::config -- "method->method" --o pineconeapicall
templatemakepineconeurl[template]:::config -- "template->template" --o makepineconeurl
keyssecrets2[keys]:::config -- "keys->keys" --o secrets2
keyssecrets3[keys]:::config -- "keys->keys" --o secrets3
keyssecrets4[keys]:::config -- "keys->keys" --o secrets4
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```