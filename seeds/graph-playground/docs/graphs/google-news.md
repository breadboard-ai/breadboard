# google-news
  - Original: [`google-news.ts`](../../src/boards/google-news.ts)
  - Graph: [`google-news.json`](../../graphs/google-news.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input1[/"input
id='input-1'"/]:::input -- "text->topic" --> prompttemplate6["prompt-template
id='prompt-template-6'"]
secrets8("secrets
id='secrets-8'"):::secrets -- "API_KEY->API_KEY" --o textcompletion7["text-completion
id='text-completion-7'"]
textcompletion7["text-completion
id='text-completion-7'"] -- "completion->text" --> output9{{"output
id='output-9'"}}:::output
prompttemplate6["prompt-template
id='prompt-template-6'"] -- "prompt->text" --> textcompletion7["text-completion
id='text-completion-7'"]
jsonata5["jsonata
id='jsonata-5'"] -- "result->headlines" --> prompttemplate6["prompt-template
id='prompt-template-6'"]
xml_to_json4["xml_to_json
id='xml_to_json-4'"] -- "json->json" --> jsonata5["jsonata
id='jsonata-5'"]
fetch3["fetch
id='fetch-3'"] -- "response->xml" --> xml_to_json4["xml_to_json
id='xml_to_json-4'"]
url_template2["url_template
id='url_template-2'"] -- "url->url" --> fetch3["fetch
id='fetch-3'"]
input1[/"input
id='input-1'"/]:::input -- "text->query" --> url_template2["url_template
id='url_template-2'"]
messageinput1[message]:::config -- "message->message" --o input1
templateurl_template2[template]:::config -- "template->template" --o url_template2
rawfetch3[raw]:::config -- "raw->raw" --o fetch3
expressionjsonata5[expression]:::config -- "expression->expression" --o jsonata5
templateprompttemplate6[template]:::config -- "template->template" --o prompttemplate6
keyssecrets8[keys]:::config -- "keys->keys" --o secrets8
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```