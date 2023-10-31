# google-news
  - Original: [`google-news.ts`](../../src/boards/google-news.ts)
  - Graph: [`google-news.json`](../../graphs/google-news.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input1[/"input <br> id='input-1'"/]:::input -- "text->topic" --> promptTemplate6["promptTemplate <br> id='promptTemplate-6'"]
secrets8("secrets <br> id='secrets-8'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText7["generateText <br> id='generateText-7'"]
generateText7["generateText <br> id='generateText-7'"] -- "completion->text" --> output9{{"output <br> id='output-9'"}}:::output
promptTemplate6["promptTemplate <br> id='promptTemplate-6'"] -- "prompt->text" --> generateText7["generateText <br> id='generateText-7'"]
jsonata5["jsonata <br> id='jsonata-5'"] -- "result->headlines" --> promptTemplate6["promptTemplate <br> id='promptTemplate-6'"]
xmlToJson4["xmlToJson <br> id='xmlToJson-4'"] -- "json->json" --> jsonata5["jsonata <br> id='jsonata-5'"]
fetch3["fetch <br> id='fetch-3'"] -- "response->xml" --> xmlToJson4["xmlToJson <br> id='xmlToJson-4'"]
urlTemplate2["urlTemplate <br> id='urlTemplate-2'"] -- "url->url" --> fetch3["fetch <br> id='fetch-3'"]
input1[/"input <br> id='input-1'"/]:::input -- "text->query" --> urlTemplate2["urlTemplate <br> id='urlTemplate-2'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```