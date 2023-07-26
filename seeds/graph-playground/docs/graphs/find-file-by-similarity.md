# find-file-by-similarity
  - Original: [`find-file-by-similarity.ts`](../../src/boards/find-file-by-similarity.ts)
  - Graph: [`find-file-by-similarity.json`](../../graphs/find-file-by-similarity.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets6("secrets
id='secrets-6'"):::secrets -- "API_KEY->API_KEY" --> embed_docs5["embed_docs
id='embed_docs-5'"]
create_vector_database1["create_vector_database
id='create_vector_database-1'"] -- "db->db" --> add_to_vector_database7["add_to_vector_database
id='add_to_vector_database-7'"]
add_to_vector_database7["add_to_vector_database
id='add_to_vector_database-7'"] -- "db->db" --> query_vector_database2["query_vector_database
id='query_vector_database-2'"]
embed_docs5["embed_docs
id='embed_docs-5'"] -- "documents->documents" --> add_to_vector_database7["add_to_vector_database
id='add_to_vector_database-7'"]
textassetsfrompath4["text-assets-from-path
id='text-assets-from-path-4'"] -- "documents->documents" --> embed_docs5["embed_docs
id='embed_docs-5'"]
input3[/"input
id='input-3'"/]:::input -- "text->path" --> textassetsfrompath4["text-assets-from-path
id='text-assets-from-path-4'"]
secrets10("secrets
id='secrets-10'"):::secrets -- "API_KEY->API_KEY" --> embed_string9["embed_string
id='embed_string-9'"]
jsonata11["jsonata
id='jsonata-11'"] -- "result->text" --> output12{{"output
id='output-12'"}}:::output
query_vector_database2["query_vector_database
id='query_vector_database-2'"] -- "results->json" --> jsonata11["jsonata
id='jsonata-11'"]
embed_string9["embed_string
id='embed_string-9'"] -- "embedding->embedding" --> query_vector_database2["query_vector_database
id='query_vector_database-2'"]
input8[/"input
id='input-8'"/]:::input -- "text->text" --> embed_string9["embed_string
id='embed_string-9'"]
messageinput3[message]:::config -- "message->message" --o input3
keyssecrets6[keys]:::config -- "keys->keys" --o secrets6
messageinput8[message]:::config -- "message->message" --o input8
keyssecrets10[keys]:::config -- "keys->keys" --o secrets10
expressionjsonata11[expression]:::config -- "expression->expression" --o jsonata11
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```