# pinecone-api-vector
  - Original: [`pinecone-api-vector.ts`](../../src/boards/pinecone-api-vector.ts)
  - Graph: [`pinecone-api-vector.json`](../../graphs/pinecone-api-vector.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
api[/"input <br> id='api'"/]:::input -- "config->config" --> config["jsonata <br> id='config'"]
config["jsonata <br> id='config'"] -- "PINECONE_API_KEY->json" --> makeheaders["jsonata <br> id='make-headers'"]
makeheaders["jsonata <br> id='make-headers'"] -- "result->headers" --> pineconeapicall["fetch <br> id='pinecone-api-call'"]
config["jsonata <br> id='config'"] -- "PINECONE_INDEX->PINECONE_INDEX" --> makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
config["jsonata <br> id='config'"] -- "PINECONE_PROJECT_ID->PINECONE_PROJECT_ID" --> makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
config["jsonata <br> id='config'"] -- "PINECONE_ENVIRONMENT->PINECONE_ENVIRONMENT" --> makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
api[/"input <br> id='api'"/]:::input -- "call->call" --> makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
makepineconeurl["urlTemplate <br> id='make-pinecone-url'"] -- "url->url" --> pineconeapicall["fetch <br> id='pinecone-api-call'"]
api[/"input <br> id='api'"/]:::input -- "body->body" --> pineconeapicall["fetch <br> id='pinecone-api-call'"]
pineconeapicall["fetch <br> id='pinecone-api-call'"] -- "response->response" --> response{{"output <br> id='response'"}}:::output
schemaapi[schema]:::config -- "schema->schema" --o api
expressionconfig[expression]:::config -- "expression->expression" --o config
rawconfig[raw]:::config -- "raw->raw" --o config
expressionmakeheaders[expression]:::config -- "expression->expression" --o makeheaders
rawpineconeapicall[raw]:::config -- "raw->raw" --o pineconeapicall
methodpineconeapicall[method]:::config -- "method->method" --o pineconeapicall
templatemakepineconeurl[template]:::config -- "template->template" --o makepineconeurl
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```