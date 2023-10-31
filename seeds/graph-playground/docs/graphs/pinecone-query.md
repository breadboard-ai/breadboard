# pinecone-query
  - Original: [`pinecone-query.ts`](../../src/boards/pinecone-query.ts)
  - Graph: [`pinecone-query.json`](../../graphs/pinecone-query.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets3("secrets <br> id='secrets-3'"):::secrets -- "PALM_KEY->PALM_KEY" --> embedText2["embedText <br> id='embedText-2'"]
jsonata5["jsonata <br> id='jsonata-5'"] -- "result->context" --> promptTemplate1["promptTemplate <br> id='promptTemplate-1'"]
pineconeapiquery4["pinecone-api-query <br> id='pinecone-api-query-4'"] -- "response->json" --> jsonata5["jsonata <br> id='jsonata-5'"]
embedText2["embedText <br> id='embedText-2'"] -- "embedding->embedding" --> pineconeapiquery4["pinecone-api-query <br> id='pinecone-api-query-4'"]
query[/"input <br> id='query'"/]:::input -- "text->text" --> embedText2["embedText <br> id='embedText-2'"]
query[/"input <br> id='query'"/]:::input -- "text->query" --> promptTemplate1["promptTemplate <br> id='promptTemplate-1'"]
secrets7("secrets <br> id='secrets-7'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText6["generateText <br> id='generateText-6'"]
generateText6["generateText <br> id='generateText-6'"] -- "completion->text" --> rag{{"output <br> id='rag'"}}:::output
promptTemplate1["promptTemplate <br> id='promptTemplate-1'"] -- "prompt->text" --> generateText6["generateText <br> id='generateText-6'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```