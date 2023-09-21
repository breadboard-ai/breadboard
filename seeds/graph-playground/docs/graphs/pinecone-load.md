# pinecone-load
  - Original: [`pinecone-load.ts`](../../src/boards/pinecone-load.ts)
  - Graph: [`pinecone-load.json`](../../graphs/pinecone-load.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
map2["map <br> id='map-2'"] -- "list->text" --> output3{{"output <br> id='output-3'"}}:::output
subgraph map-2
map2_secrets3("secrets <br> id='secrets-3'"):::secrets -- "PINECONE_API_KEY->json" --> map2_makeheaders["jsonata <br> id='make-headers'"]
map2_makeheaders["jsonata <br> id='make-headers'"] -- "result->headers" --> map2_pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"]
map2_secrets4("secrets <br> id='secrets-4'"):::secrets -- "PINECONE_URL->PINECONE_URL" --> map2_makepineconeurl["promptTemplate <br> id='make-pinecone-url'"]
map2_makepineconeurl["promptTemplate <br> id='make-pinecone-url'"] -- "prompt->url" --> map2_pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"]
map2_pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"] -- "response->item" --> map2_output2{{"output <br> id='output-2'"}}:::output
map2_formattoapi["jsonata <br> id='format-to-api'"] -- "result->body" --> map2_pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"]
map2_generateembeddings["map <br> id='generate-embeddings'"] -- "list->json" --> map2_formattoapi["jsonata <br> id='format-to-api'"]
map2_input1[/"input <br> id='input-1'"/]:::input -- "item->list" --> map2_generateembeddings["map <br> id='generate-embeddings'"]
end
map-2:::slotted -- "lamdba->lamdba" --o map2

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