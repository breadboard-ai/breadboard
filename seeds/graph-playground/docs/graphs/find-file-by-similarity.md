# find-file-by-similarity
  - Original: [`find-file-by-similarity.ts`](../../src/boards/find-file-by-similarity.ts)
  - Graph: [`find-file-by-similarity.json`](../../graphs/find-file-by-similarity.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets6("secrets <br> id='secrets-6'"):::secrets -- "PALM_KEY->PALM_KEY" --> embedDocs5["embedDocs <br> id='embedDocs-5'"]
secrets8("secrets <br> id='secrets-8'"):::secrets -- "CACHE_DB->path" --> cache7["cache <br> id='cache-7'"]
cache7["cache <br> id='cache-7'"] -- "cache->cache" --> embedDocs5["embedDocs <br> id='embedDocs-5'"]
createVectorDatabase1["createVectorDatabase <br> id='createVectorDatabase-1'"] -- "db->db" --> addToVectorDatabase9["addToVectorDatabase <br> id='addToVectorDatabase-9'"]
addToVectorDatabase9["addToVectorDatabase <br> id='addToVectorDatabase-9'"] -- "db->db" --> queryVectorDatabase2["queryVectorDatabase <br> id='queryVectorDatabase-2'"]
embedDocs5["embedDocs <br> id='embedDocs-5'"] -- "documents->documents" --> addToVectorDatabase9["addToVectorDatabase <br> id='addToVectorDatabase-9'"]
textAssetsFromPath4["textAssetsFromPath <br> id='textAssetsFromPath-4'"] -- "documents->documents" --> embedDocs5["embedDocs <br> id='embedDocs-5'"]
input3[/"input <br> id='input-3'"/]:::input -- "text->path" --> textAssetsFromPath4["textAssetsFromPath <br> id='textAssetsFromPath-4'"]
secrets12("secrets <br> id='secrets-12'"):::secrets -- "PALM_KEY->PALM_KEY" --> embedString11["embedString <br> id='embedString-11'"]
jsonata13["jsonata <br> id='jsonata-13'"] -- "result->text" --> output14{{"output <br> id='output-14'"}}:::output
queryVectorDatabase2["queryVectorDatabase <br> id='queryVectorDatabase-2'"] -- "results->json" --> jsonata13["jsonata <br> id='jsonata-13'"]
embedString11["embedString <br> id='embedString-11'"] -- "embedding->embedding" --> queryVectorDatabase2["queryVectorDatabase <br> id='queryVectorDatabase-2'"]
input10[/"input <br> id='input-10'"/]:::input -- "text->text" --> embedString11["embedString <br> id='embedString-11'"]
messageinput3[message]:::config -- "message->message" --o input3
keyssecrets6[keys]:::config -- "keys->keys" --o secrets6
keyssecrets8[keys]:::config -- "keys->keys" --o secrets8
messageinput10[message]:::config -- "message->message" --o input10
keyssecrets12[keys]:::config -- "keys->keys" --o secrets12
expressionjsonata13[expression]:::config -- "expression->expression" --o jsonata13
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```