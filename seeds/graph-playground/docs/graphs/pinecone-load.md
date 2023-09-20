# pinecone-load
  - Original: [`pinecone-load.ts`](../../src/boards/pinecone-load.ts)
  - Graph: [`pinecone-load.json`](../../graphs/pinecone-load.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
map3["map <br> id='map-3'"] -- "list->text" --> output4{{"output <br> id='output-4'"}}:::output
batcher2["batcher <br> id='batcher-2'"] -- "list->list" --> map3["map <br> id='map-3'"]
map1["map <br> id='map-1'"] -- "list->list" --> batcher2["batcher <br> id='batcher-2'"]
getcontent["jsonata <br> id='get-content'"] -- "result->list" --> map1["map <br> id='map-1'"]
loadchunks["fetch <br> id='load-chunks'"] -- "response->json" --> getcontent["jsonata <br> id='get-content'"]
url[/"input <br> id='url'"/]:::input -- "text->url" --> loadchunks["fetch <br> id='load-chunks'"]
expressiongetcontent[expression]:::config -- "expression->expression" --o getcontent
boardmap1[board]:::config -- "board->board" --o map1
sizebatcher2[size]:::config -- "size->size" --o batcher2
boardmap3[board]:::config -- "board->board" --o map3
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```