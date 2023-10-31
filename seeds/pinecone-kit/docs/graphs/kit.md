# kit
  - Original: [`kit.ts`](../../src/boards/kit.ts)
  - Graph: [`kit.json`](../../graphs/kit.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;

subgraph sg_config [config]
config_secrets1("secrets <br> id='secrets-1'"):::secrets -- "PINECONE_INDEX->PINECONE_INDEX" --> config_start["jsonata <br> id='start'"]
config_secrets2("secrets <br> id='secrets-2'"):::secrets -- "PINECONE_PROJECT_ID->PINECONE_PROJECT_ID" --> config_start["jsonata <br> id='start'"]
config_secrets3("secrets <br> id='secrets-3'"):::secrets -- "PINECONE_ENVIRONMENT->PINECONE_ENVIRONMENT" --> config_start["jsonata <br> id='start'"]
config_secrets4("secrets <br> id='secrets-4'"):::secrets -- "PINECONE_API_KEY->PINECONE_API_KEY" --> config_start["jsonata <br> id='start'"]
config_start["jsonata <br> id='start'"] -- "result->config" --> config_result{{"output <br> id='result'"}}:::output
end


subgraph sg_query [query]
query_queryapi(("passthrough <br> id='query-api'")):::passthrough -- "call->call" --> query_vector[["include <br> id='vector'"]]:::include
query_config[["include <br> id='config'"]]:::include -- "config->config" --> query_vector[["include <br> id='vector'"]]:::include
query_vector[["include <br> id='vector'"]]:::include -- "response->response" --> query_response{{"output <br> id='response'"}}:::output
query_makebody["jsonata <br> id='make-body'"] -- "result->body" --> query_vector[["include <br> id='vector'"]]:::include
query_query[/"input <br> id='query'"/]:::input -- "embedding->json" --> query_makebody["jsonata <br> id='make-body'"]
end


subgraph sg_upsert [upsert]
upsert_upsert(("passthrough <br> id='upsert'")):::passthrough -- "call->call" --> upsert_vector[["include <br> id='vector'"]]:::include
upsert_config[["include <br> id='config'"]]:::include -- "config->config" --> upsert_vector[["include <br> id='vector'"]]:::include
upsert_vector[["include <br> id='vector'"]]:::include -- "response->response" --> upsert_output1{{"output <br> id='output-1'"}}:::output
upsert_vectors[/"input <br> id='vectors'"/]:::input -- "vectors->body" --> upsert_vector[["include <br> id='vector'"]]:::include
end


subgraph sg_vector [vector]
vector_api[/"input <br> id='api'"/]:::input -- "config->config" --> vector_config["jsonata <br> id='config'"]
vector_config["jsonata <br> id='config'"] -- "PINECONE_API_KEY->json" --> vector_makeheaders["jsonata <br> id='make-headers'"]
vector_makeheaders["jsonata <br> id='make-headers'"] -- "result->headers" --> vector_pineconeapicall["fetch <br> id='pinecone-api-call'"]
vector_config["jsonata <br> id='config'"] -- "PINECONE_INDEX->PINECONE_INDEX" --> vector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
vector_config["jsonata <br> id='config'"] -- "PINECONE_PROJECT_ID->PINECONE_PROJECT_ID" --> vector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
vector_config["jsonata <br> id='config'"] -- "PINECONE_ENVIRONMENT->PINECONE_ENVIRONMENT" --> vector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
vector_api[/"input <br> id='api'"/]:::input -- "call->call" --> vector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
vector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"] -- "url->url" --> vector_pineconeapicall["fetch <br> id='pinecone-api-call'"]
vector_api[/"input <br> id='api'"/]:::input -- "body->body" --> vector_pineconeapicall["fetch <br> id='pinecone-api-call'"]
vector_pineconeapicall["fetch <br> id='pinecone-api-call'"] -- "response->response" --> vector_response{{"output <br> id='response'"}}:::output
end

classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```