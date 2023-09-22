# pinecone-query
  - Original: [`pinecone-query.ts`](../../src/boards/pinecone-query.ts)
  - Graph: [`pinecone-query.json`](../../graphs/pinecone-query.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
queryapi(("passthrough <br> id='query-api'")):::passthrough -- "call->call" --> pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
secrets3("secrets <br> id='secrets-3'"):::secrets -- "PALM_KEY->PALM_KEY" --> embedString2["embedString <br> id='embedString-2'"]
jsonata4["jsonata <br> id='jsonata-4'"] -- "result->context" --> promptTemplate1["promptTemplate <br> id='promptTemplate-1'"]
pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include -- "response->json" --> jsonata4["jsonata <br> id='jsonata-4'"]
makebody["jsonata <br> id='make-body'"] -- "result->body" --> pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
embedString2["embedString <br> id='embedString-2'"] -- "embedding->json" --> makebody["jsonata <br> id='make-body'"]
query[/"input <br> id='query'"/]:::input -- "text->text" --> embedString2["embedString <br> id='embedString-2'"]
query[/"input <br> id='query'"/]:::input -- "text->query" --> promptTemplate1["promptTemplate <br> id='promptTemplate-1'"]
secrets6("secrets <br> id='secrets-6'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText5["generateText <br> id='generateText-5'"]
generateText5["generateText <br> id='generateText-5'"] -- "completion->text" --> rag{{"output <br> id='rag'"}}:::output
promptTemplate1["promptTemplate <br> id='promptTemplate-1'"] -- "prompt->text" --> generateText5["generateText <br> id='generateText-5'"]
expressionmakebody[expression]:::config -- "expression->expression" --o makebody
templatepromptTemplate1[template]:::config -- "template->template" --o promptTemplate1
$refpineconeapicall[$ref]:::config -- "$ref->$ref" --o pineconeapicall
callqueryapi[call]:::config -- "call->call" --o queryapi
keyssecrets3[keys]:::config -- "keys->keys" --o secrets3
expressionjsonata4[expression]:::config -- "expression->expression" --o jsonata4
keyssecrets6[keys]:::config -- "keys->keys" --o secrets6
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```