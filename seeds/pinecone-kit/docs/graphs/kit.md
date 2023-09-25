# kit
  - Original: [`kit.ts`](../../src/boards/kit.ts)
  - Graph: [`kit.json`](../../graphs/kit.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
$refconfig[$ref]:::config -- "$ref->$ref" --o config
$refquery[$ref]:::config -- "$ref->$ref" --o query
$refupsert[$ref]:::config -- "$ref->$ref" --o upsert
$refvector[$ref]:::config -- "$ref->$ref" --o vector

subgraph sg_pineconeapiconfig [pinecone-api-config]
pineconeapiconfig_secrets1("secrets <br> id='secrets-1'"):::secrets -- "PINECONE_INDEX->PINECONE_INDEX" --> pineconeapiconfig_start["jsonata <br> id='start'"]
pineconeapiconfig_secrets2("secrets <br> id='secrets-2'"):::secrets -- "PINECONE_PROJECT_ID->PINECONE_PROJECT_ID" --> pineconeapiconfig_start["jsonata <br> id='start'"]
pineconeapiconfig_secrets3("secrets <br> id='secrets-3'"):::secrets -- "PINECONE_ENVIRONMENT->PINECONE_ENVIRONMENT" --> pineconeapiconfig_start["jsonata <br> id='start'"]
pineconeapiconfig_secrets4("secrets <br> id='secrets-4'"):::secrets -- "PINECONE_API_KEY->PINECONE_API_KEY" --> pineconeapiconfig_start["jsonata <br> id='start'"]
pineconeapiconfig_start["jsonata <br> id='start'"] -- "result->config" --> pineconeapiconfig_result{{"output <br> id='result'"}}:::output






end


subgraph sg_pineconeapiquery [pinecone-api-query]
pineconeapiquery_queryapi(("passthrough <br> id='query-api'")):::passthrough -- "call->call" --> pineconeapiquery_pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
pineconeapiquery_include1[["include <br> id='include-1'"]]:::include -- "config->config" --> pineconeapiquery_pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
pineconeapiquery_pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include -- "response->response" --> pineconeapiquery_response{{"output <br> id='response'"}}:::output
pineconeapiquery_makebody["jsonata <br> id='make-body'"] -- "result->body" --> pineconeapiquery_pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
pineconeapiquery_query[/"input <br> id='query'"/]:::input -- "embedding->json" --> pineconeapiquery_makebody["jsonata <br> id='make-body'"]





end


subgraph sg_pineconeapiupsert [pinecone-api-upsert]
pineconeapiupsert_upsert(("passthrough <br> id='upsert'")):::passthrough -- "call->call" --> pineconeapiupsert_pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
pineconeapiupsert_include1[["include <br> id='include-1'"]]:::include -- "config->config" --> pineconeapiupsert_pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include
pineconeapiupsert_pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include -- "response->response" --> pineconeapiupsert_output2{{"output <br> id='output-2'"}}:::output
pineconeapiupsert_vectors[/"input <br> id='vectors'"/]:::input -- "vectors->body" --> pineconeapiupsert_pineconeapicall[["include <br> id='pinecone-api-call'"]]:::include




end


subgraph sg_pineconeapivector [pinecone-api-vector]
pineconeapivector_api[/"input <br> id='api'"/]:::input -- "config->config" --> pineconeapivector_config["jsonata <br> id='config'"]
pineconeapivector_config["jsonata <br> id='config'"] -- "PINECONE_API_KEY->json" --> pineconeapivector_makeheaders["jsonata <br> id='make-headers'"]
pineconeapivector_makeheaders["jsonata <br> id='make-headers'"] -- "result->headers" --> pineconeapivector_pineconeapicall["fetch <br> id='pinecone-api-call'"]
pineconeapivector_config["jsonata <br> id='config'"] -- "PINECONE_INDEX->PINECONE_INDEX" --> pineconeapivector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
pineconeapivector_config["jsonata <br> id='config'"] -- "PINECONE_PROJECT_ID->PINECONE_PROJECT_ID" --> pineconeapivector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
pineconeapivector_config["jsonata <br> id='config'"] -- "PINECONE_ENVIRONMENT->PINECONE_ENVIRONMENT" --> pineconeapivector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
pineconeapivector_api[/"input <br> id='api'"/]:::input -- "call->call" --> pineconeapivector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"]
pineconeapivector_makepineconeurl["urlTemplate <br> id='make-pinecone-url'"] -- "url->url" --> pineconeapivector_pineconeapicall["fetch <br> id='pinecone-api-call'"]
pineconeapivector_api[/"input <br> id='api'"/]:::input -- "body->body" --> pineconeapivector_pineconeapicall["fetch <br> id='pinecone-api-call'"]
pineconeapivector_pineconeapicall["fetch <br> id='pinecone-api-call'"] -- "response->response" --> pineconeapivector_response{{"output <br> id='response'"}}:::output







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