# pinecone-api-query
  - Original: [`pinecone-api-query.ts`](../../src/boards/pinecone-api-query.ts)
  - Graph: [`pinecone-api-query.json`](../../graphs/pinecone-api-query.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
queryapi(("passthrough <br> id='query-api'")):::passthrough -- "call->call" --> pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
include1[["include <br> id='include-1'"]]:::include -- "config->config" --> pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include -- "response->response" --> response{{"output <br> id='response'"}}:::output
makebody["jsonata <br> id='make-body'"] -- "result->body" --> pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
query[/"input <br> id='query'"/]:::input -- "embedding->json" --> makebody["jsonata <br> id='make-body'"]
expressionmakebody[expression]:::config -- "expression->expression" --o makebody
$refpineconeapicall[$ref]:::config -- "$ref->$ref" --o pineconeapicall
callqueryapi[call]:::config -- "call->call" --o queryapi
$refinclude1[$ref]:::config -- "$ref->$ref" --o include1
schemaquery[schema]:::config -- "schema->schema" --o query
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```