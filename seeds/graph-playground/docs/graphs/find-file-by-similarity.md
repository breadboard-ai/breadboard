# find-file-by-similarity
  - Original: [`find-file-by-similarity.ts`](../../src/boards/find-file-by-similarity.ts)
  - Graph: [`find-file-by-similarity.json`](../../graphs/find-file-by-similarity.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets6("secrets
id='secrets-6'"):::secrets -- "API_KEY->API_KEY" --> embed_docs5["embed_docs
id='embed_docs-5'"]
secrets8("secrets
id='secrets-8'"):::secrets -- "CACHE_DB->path" --> cache7["cache
id='cache-7'"]
cache7["cache
id='cache-7'"] -- "cache->cache" --> embed_docs5["embed_docs
id='embed_docs-5'"]
create_vector_database1["create_vector_database
id='create_vector_database-1'"] -- "db->db" --> add_to_vector_database9["add_to_vector_database
id='add_to_vector_database-9'"]
add_to_vector_database9["add_to_vector_database
id='add_to_vector_database-9'"] -- "db->db" --> query_vector_database2["query_vector_database
id='query_vector_database-2'"]
embed_docs5["embed_docs
id='embed_docs-5'"] -- "documents->documents" --> add_to_vector_database9["add_to_vector_database
id='add_to_vector_database-9'"]
textassetsfrompath4["text-assets-from-path
id='text-assets-from-path-4'"] -- "documents->documents" --> embed_docs5["embed_docs
id='embed_docs-5'"]
input3[/"input
id='input-3'"/]:::input -- "text->path" --> textassetsfrompath4["text-assets-from-path
id='text-assets-from-path-4'"]
secrets12("secrets
id='secrets-12'"):::secrets -- "API_KEY->API_KEY" --> embed_string11["embed_string
id='embed_string-11'"]
jsonata13["jsonata
id='jsonata-13'"] -- "result->text" --> output14{{"output
id='output-14'"}}:::output
query_vector_database2["query_vector_database
id='query_vector_database-2'"] -- "results->json" --> jsonata13["jsonata
id='jsonata-13'"]
embed_string11["embed_string
id='embed_string-11'"] -- "embedding->embedding" --> query_vector_database2["query_vector_database
id='query_vector_database-2'"]
input10[/"input
id='input-10'"/]:::input -- "text->text" --> embed_string11["embed_string
id='embed_string-11'"]
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