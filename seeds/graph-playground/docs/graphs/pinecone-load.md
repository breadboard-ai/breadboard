# pinecone-load
  - Original: [`pinecone-load.ts`](../../src/boards/pinecone-load.ts)
  - Graph: [`pinecone-load.json`](../../graphs/pinecone-load.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
pineconeupsert["map <br> id='pinecone-upsert'"] -- "list->text" --> output2{{"output <br> id='output-2'"}}:::output
subgraph pinecone-upsert
pineconeupsert_secrets3("secrets <br> id='secrets-3'"):::secrets -- "PINECONE_API_KEY->json" --> pineconeupsert_makeheaders["jsonata <br> id='make-headers'"]
pineconeupsert_makeheaders["jsonata <br> id='make-headers'"] -- "result->headers" --> pineconeupsert_pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"]
pineconeupsert_secrets4("secrets <br> id='secrets-4'"):::secrets -- "PINECONE_URL->PINECONE_URL" --> pineconeupsert_makepineconeurl["promptTemplate <br> id='make-pinecone-url'"]
pineconeupsert_makepineconeurl["promptTemplate <br> id='make-pinecone-url'"] -- "prompt->url" --> pineconeupsert_pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"]
pineconeupsert_pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"] -- "response->item" --> pineconeupsert_output2{{"output <br> id='output-2'"}}:::output
pineconeupsert_formattoapi["jsonata <br> id='format-to-api'"] -- "result->body" --> pineconeupsert_pineconeupsertapi["fetch <br> id='pinecone-upsert-api'"]
pineconeupsert_input1[/"input <br> id='input-1'"/]:::input -- "item->json" --> pineconeupsert_formattoapi["jsonata <br> id='format-to-api'"]
end
pinecone-upsert:::slotted -- "lamdba->lamdba" --o pineconeupsert

batcher1["batcher <br> id='batcher-1'"] -- "list->list" --> pineconeupsert["map <br> id='pinecone-upsert'"]
generateembeddings["map <br> id='generate-embeddings'"] -- "list->list" --> batcher1["batcher <br> id='batcher-1'"]
subgraph generate-embeddings
generateembeddings_embedString4["embedString <br> id='embedString-4'"] -- "embedding->embedding" --> generateembeddings_merge["append <br> id='merge'"]
generateembeddings_secrets5("secrets <br> id='secrets-5'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateembeddings_embedString4["embedString <br> id='embedString-4'"]
generateembeddings_jsonata3["jsonata <br> id='jsonata-3'"] -- "result->text" --> generateembeddings_embedString4["embedString <br> id='embedString-4'"]
generateembeddings_input1[/"input <br> id='input-1'"/]:::input -- "item->json" --> generateembeddings_jsonata3["jsonata <br> id='jsonata-3'"]
generateembeddings_merge["append <br> id='merge'"] -- "accumulator->item" --> generateembeddings_output2{{"output <br> id='output-2'"}}:::output
generateembeddings_input1[/"input <br> id='input-1'"/]:::input -- "item->accumulator" --> generateembeddings_merge["append <br> id='merge'"]
end
generate-embeddings:::slotted -- "lamdba->lamdba" --o generateembeddings

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