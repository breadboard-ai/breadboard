# pinecone-query
  - Original: [`pinecone-query.ts`](../../src/boards/pinecone-query.ts)
  - Graph: [`pinecone-query.json`](../../graphs/pinecone-query.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PINECONE_API_KEY->json" --> makeheaders["jsonata <br> id='make-headers'"]
makeheaders["jsonata <br> id='make-headers'"] -- "result->headers" --> pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"]
secrets2("secrets <br> id='secrets-2'"):::secrets -- "PINECONE_URL->PINECONE_URL" --> makepineconeurl["promptTemplate <br> id='make-pinecone-url'"]
makepineconeurl["promptTemplate <br> id='make-pinecone-url'"] -- "prompt->url" --> pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"]
secrets4("secrets <br> id='secrets-4'"):::secrets -- "PALM_KEY->PALM_KEY" --> embedString3["embedString <br> id='embedString-3'"]
jsonata5["jsonata <br> id='jsonata-5'"] -- "result->text" --> rag{{"output <br> id='rag'"}}:::output
pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"] -- "response->json" --> jsonata5["jsonata <br> id='jsonata-5'"]
makebody["jsonata <br> id='make-body'"] -- "result->body" --> pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"]
embedString3["embedString <br> id='embedString-3'"] -- "embedding->json" --> makebody["jsonata <br> id='make-body'"]
query[/"input <br> id='query'"/]:::input -- "text->text" --> embedString3["embedString <br> id='embedString-3'"]
expressionmakeheaders[expression]:::config -- "expression->expression" --o makeheaders
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
rawpineconeupsertapi[raw]:::config -- "raw->raw" --o pineconeupsertapi
methodpineconeupsertapi[method]:::config -- "method->method" --o pineconeupsertapi
templatemakepineconeurl[template]:::config -- "template->template" --o makepineconeurl
keyssecrets2[keys]:::config -- "keys->keys" --o secrets2
expressionmakebody[expression]:::config -- "expression->expression" --o makebody
keyssecrets4[keys]:::config -- "keys->keys" --o secrets4
expressionjsonata5[expression]:::config -- "expression->expression" --o jsonata5
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```