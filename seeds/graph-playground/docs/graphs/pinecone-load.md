# pinecone-load
  - Original: [`pinecone-load.ts`](../../src/boards/pinecone-load.ts)
  - Graph: [`pinecone-load.json`](../../graphs/pinecone-load.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
lambda2["lambda <br> id='lambda-2'"] -- "board->board" --o map3["map <br> id='map-3'"]
subgraph sg_lambda2 [lambda-2]
lambda2_lambda3["lambda <br> id='lambda-3'"] -- "board->board" --o lambda2_generateembeddings["map <br> id='generate-embeddings'"]
subgraph sg_lambda3 [lambda-3]
lambda2_lambda3_embedText4["embedText <br> id='embedText-4'"] -- "embedding->embedding" --> lambda2_lambda3_merge["append <br> id='merge'"]
lambda2_lambda3_secrets5("secrets <br> id='secrets-5'"):::secrets -- "PALM_KEY->PALM_KEY" --> lambda2_lambda3_embedText4["embedText <br> id='embedText-4'"]
lambda2_lambda3_jsonata3["jsonata <br> id='jsonata-3'"] -- "result->text" --> lambda2_lambda3_embedText4["embedText <br> id='embedText-4'"]
lambda2_lambda3_input1[/"input <br> id='input-1'"/]:::input -- "item->json" --> lambda2_lambda3_jsonata3["jsonata <br> id='jsonata-3'"]
lambda2_lambda3_merge["append <br> id='merge'"] -- "accumulator->item" --> lambda2_lambda3_output2{{"output <br> id='output-2'"}}:::output
lambda2_lambda3_input1[/"input <br> id='input-1'"/]:::input -- "item->accumulator" --> lambda2_lambda3_merge["append <br> id='merge'"]
end
sg_lambda3:::slotted -- "lamdba->lamdba" --o lambda2_lambda3

lambda2_pineconeapiupsert4["pinecone-api-upsert <br> id='pinecone-api-upsert-4'"] -- "response->item" --> lambda2_output2{{"output <br> id='output-2'"}}:::output
lambda2_formattoapi["jsonata <br> id='format-to-api'"] -- "result->vectors" --> lambda2_pineconeapiupsert4["pinecone-api-upsert <br> id='pinecone-api-upsert-4'"]
lambda2_generateembeddings["map <br> id='generate-embeddings'"] -- "list->json" --> lambda2_formattoapi["jsonata <br> id='format-to-api'"]
lambda2_input1[/"input <br> id='input-1'"/]:::input -- "item->list" --> lambda2_generateembeddings["map <br> id='generate-embeddings'"]
end
sg_lambda2:::slotted -- "lamdba->lamdba" --o lambda2

map3["map <br> id='map-3'"] -- "list->text" --> output4{{"output <br> id='output-4'"}}:::output
batch1["batch <br> id='batch-1'"] -- "list->list" --> map3["map <br> id='map-3'"]
getcontent["jsonata <br> id='get-content'"] -- "result->list" --> batch1["batch <br> id='batch-1'"]
loadchunks["fetch <br> id='load-chunks'"] -- "response->json" --> getcontent["jsonata <br> id='get-content'"]
url[/"input <br> id='url'"/]:::input -- "text->url" --> loadchunks["fetch <br> id='load-chunks'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```