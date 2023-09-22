# pinecone-api-upsert
  - Original: [`pinecone-api-upsert.ts`](../../src/boards/pinecone-api-upsert.ts)
  - Graph: [`pinecone-api-upsert.json`](../../graphs/pinecone-api-upsert.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
upsert(("passthrough <br> id='upsert'")):::passthrough -- "call->call" --> pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
include1[["include <br> id='include-1'"]]:::include -- "config->config" --> pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include -- "response->response" --> output2{{"output <br> id='output-2'"}}:::output
sendasis["jsonata <br> id='send-as-is'"] -- "result->body" --> pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
vectors[/"input <br> id='vectors'"/]:::input -- "vectors->vectors" --> sendasis["jsonata <br> id='send-as-is'"]
$refpineconeapicall[$ref]:::config -- "$ref->$ref" --o pineconeapicall
callupsert[call]:::config -- "call->call" --o upsert
$refinclude1[$ref]:::config -- "$ref->$ref" --o include1
schemavectors[schema]:::config -- "schema->schema" --o vectors
expressionsendasis[expression]:::config -- "expression->expression" --o sendasis
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```