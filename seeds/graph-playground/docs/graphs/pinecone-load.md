# pinecone-load
  - Original: [`pinecone-load.ts`](../../src/boards/pinecone-load.ts)
  - Graph: [`pinecone-load.json`](../../graphs/pinecone-load.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
pineconeupsert["map <br> id='pinecone-upsert'"] -- "list->text" --> output2{{"output <br> id='output-2'"}}:::output
batcher1["batcher <br> id='batcher-1'"] -- "list->list" --> pineconeupsert["map <br> id='pinecone-upsert'"]
generateembeddings["map <br> id='generate-embeddings'"] -- "list->list" --> batcher1["batcher <br> id='batcher-1'"]
getcontent["jsonata <br> id='get-content'"] -- "result->list" --> generateembeddings["map <br> id='generate-embeddings'"]
loadchunks["fetch <br> id='load-chunks'"] -- "response->json" --> getcontent["jsonata <br> id='get-content'"]
url[/"input <br> id='url'"/]:::input -- "text->url" --> loadchunks["fetch <br> id='load-chunks'"]
expressiongetcontent[expression]:::config -- "expression->expression" --o getcontent
boardgenerateembeddings[board]:::config -- "board->board" --o generateembeddings
sizebatcher1[size]:::config -- "size->size" --o batcher1
boardpineconeupsert[board]:::config -- "board->board" --o pineconeupsert
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```