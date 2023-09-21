# pinecone-query
  - Original: [`pinecone-query.ts`](../../src/boards/pinecone-query.ts)
  - Graph: [`pinecone-query.json`](../../graphs/pinecone-query.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PINECONE_API_KEY->json" --> makeheaders["jsonata <br> id='make-headers'"]
makeheaders["jsonata <br> id='make-headers'"] -- "result->headers" --> pineconequeryapi["fetch <br> id='pinecone-query-api'"]
secrets2("secrets <br> id='secrets-2'"):::secrets -- "PINECONE_URL->PINECONE_URL" --> makepineconeurl["promptTemplate <br> id='make-pinecone-url'"]
makepineconeurl["promptTemplate <br> id='make-pinecone-url'"] -- "prompt->url" --> pineconequeryapi["fetch <br> id='pinecone-query-api'"]
secrets5("secrets <br> id='secrets-5'"):::secrets -- "PALM_KEY->PALM_KEY" --> embedString4["embedString <br> id='embedString-4'"]
jsonata6["jsonata <br> id='jsonata-6'"] -- "result->context" --> promptTemplate3["promptTemplate <br> id='promptTemplate-3'"]
pineconequeryapi["fetch <br> id='pinecone-query-api'"] -- "response->json" --> jsonata6["jsonata <br> id='jsonata-6'"]
makebody["jsonata <br> id='make-body'"] -- "result->body" --> pineconequeryapi["fetch <br> id='pinecone-query-api'"]
embedString4["embedString <br> id='embedString-4'"] -- "embedding->json" --> makebody["jsonata <br> id='make-body'"]
query[/"input <br> id='query'"/]:::input -- "text->text" --> embedString4["embedString <br> id='embedString-4'"]
query[/"input <br> id='query'"/]:::input -- "text->query" --> promptTemplate3["promptTemplate <br> id='promptTemplate-3'"]
secrets8("secrets <br> id='secrets-8'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText7["generateText <br> id='generateText-7'"]
generateText7["generateText <br> id='generateText-7'"] -- "completion->text" --> rag{{"output <br> id='rag'"}}:::output
promptTemplate3["promptTemplate <br> id='promptTemplate-3'"] -- "prompt->text" --> generateText7["generateText <br> id='generateText-7'"]
expressionmakeheaders[expression]:::config -- "expression->expression" --o makeheaders
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
rawpineconequeryapi[raw]:::config -- "raw->raw" --o pineconequeryapi
methodpineconequeryapi[method]:::config -- "method->method" --o pineconequeryapi
templatemakepineconeurl[template]:::config -- "template->template" --o makepineconeurl
keyssecrets2[keys]:::config -- "keys->keys" --o secrets2
expressionmakebody[expression]:::config -- "expression->expression" --o makebody
templatepromptTemplate3[template]:::config -- "template->template" --o promptTemplate3
keyssecrets5[keys]:::config -- "keys->keys" --o secrets5
expressionjsonata6[expression]:::config -- "expression->expression" --o jsonata6
keyssecrets8[keys]:::config -- "keys->keys" --o secrets8
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```