# pinecone-load
  - Original: [`pinecone-load.ts`](../../src/boards/pinecone-load.ts)
  - Graph: [`pinecone-load.json`](../../graphs/pinecone-load.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
map2["map <br> id='map-2'"] -- "list->text" --> output3{{"output <br> id='output-3'"}}:::output
subgraph sg_map2 [map-2]
map2_pineconeupsert3["pinecone-upsert <br> id='pinecone-upsert-3'"] -- "response->item" --> map2_output2{{"output <br> id='output-2'"}}:::output
map2_formattoapi["jsonata <br> id='format-to-api'"] -- "result->vectors" --> map2_pineconeupsert3["pinecone-upsert <br> id='pinecone-upsert-3'"]
map2_generateembeddings["map <br> id='generate-embeddings'"] -- "list->json" --> map2_formattoapi["jsonata <br> id='format-to-api'"]
subgraph sg_generateembeddings [generate-embeddings]
map2_generateembeddings_embedString4["embedString <br> id='embedString-4'"] -- "embedding->embedding" --> map2_generateembeddings_merge["append <br> id='merge'"]
map2_generateembeddings_secrets5("secrets <br> id='secrets-5'"):::secrets -- "PALM_KEY->PALM_KEY" --> map2_generateembeddings_embedString4["embedString <br> id='embedString-4'"]
map2_generateembeddings_jsonata3["jsonata <br> id='jsonata-3'"] -- "result->text" --> map2_generateembeddings_embedString4["embedString <br> id='embedString-4'"]
map2_generateembeddings_input1[/"input <br> id='input-1'"/]:::input -- "item->json" --> map2_generateembeddings_jsonata3["jsonata <br> id='jsonata-3'"]
map2_generateembeddings_merge["append <br> id='merge'"] -- "accumulator->item" --> map2_generateembeddings_output2{{"output <br> id='output-2'"}}:::output
map2_generateembeddings_input1[/"input <br> id='input-1'"/]:::input -- "item->accumulator" --> map2_generateembeddings_merge["append <br> id='merge'"]


end
sg_generateembeddings:::slotted -- "lamdba->lamdba" --o map2_generateembeddings

map2_input1[/"input <br> id='input-1'"/]:::input -- "item->list" --> map2_generateembeddings["map <br> id='generate-embeddings'"]


end
sg_map2:::slotted -- "lamdba->lamdba" --o map2

batcher1["batcher <br> id='batcher-1'"] -- "list->list" --> map2["map <br> id='map-2'"]
getcontent["jsonata <br> id='get-content'"] -- "result->list" --> batcher1["batcher <br> id='batcher-1'"]
loadchunks["fetch <br> id='load-chunks'"] -- "response->json" --> getcontent["jsonata <br> id='get-content'"]
url[/"input <br> id='url'"/]:::input -- "text->url" --> loadchunks["fetch <br> id='load-chunks'"]
expressiongetcontent[expression]:::config -- "expression->expression" --o getcontent
sizebatcher1[size]:::config -- "size->size" --o batcher1

classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```