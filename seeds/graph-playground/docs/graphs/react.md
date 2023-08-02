# react
  - Original: [`react.ts`](../../src/boards/react.ts)
  - Graph: [`react.json`](../../graphs/react.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
getdescriptions4["get-descriptions
id='get-descriptions-4'"] -- "descriptions->descriptions" --o prompttemplate3["prompt-template
id='prompt-template-3'"]
gettools5["get-tools
id='get-tools-5'"] -- "tools->tools" --o prompttemplate3["prompt-template
id='prompt-template-3'"]
localmemory2["local-memory
id='local-memory-2'"] -- "context->memory" --> prompttemplate3["prompt-template
id='prompt-template-3'"]
secrets1("secrets
id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["text-completion
id='react-completion'"]
compute["run-javascript
id='compute'"] -- "result->Observation" --> localmemory2["local-memory
id='local-memory-2'"]
mathfunctioncompletion["text-completion
id='math-function-completion'"] -- "completion->code" --> compute["run-javascript
id='compute'"]
secrets1("secrets
id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o mathfunctioncompletion["text-completion
id='math-function-completion'"]
mathfunction["prompt-template
id='math-function'"] -- "prompt->text" --> mathfunctioncompletion["text-completion
id='math-function-completion'"]
textcompletion8["text-completion
id='text-completion-8'"] -- "completion->Observation" --> localmemory2["local-memory
id='local-memory-2'"]
secrets1("secrets
id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o textcompletion8["text-completion
id='text-completion-8'"]
summarizingtemplate["prompt-template
id='summarizing-template'"] -- "prompt->text" --> textcompletion8["text-completion
id='text-completion-8'"]
secrets1("secrets
id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o url_template9["url_template
id='url_template-9'"]
secrets1("secrets
id='secrets-1'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --o url_template9["url_template
id='url_template-9'"]
jsonata11["jsonata
id='jsonata-11'"] -- "result->context" --> summarizingtemplate["prompt-template
id='summarizing-template'"]
fetch10["fetch
id='fetch-10'"] -- "response->json" --> jsonata11["jsonata
id='jsonata-11'"]
url_template9["url_template
id='url_template-9'"] -- "url->url" --> fetch10["fetch
id='fetch-10'"]
passthrough12(("passthrough
id='passthrough-12'")):::passthrough -- "search->question" --> summarizingtemplate["prompt-template
id='summarizing-template'"]
passthrough12(("passthrough
id='passthrough-12'")):::passthrough -- "search->query" --> url_template9["url_template
id='url_template-9'"]
parsecompletion7["parse-completion
id='parse-completion-7'"] -- "search->search" --> passthrough12(("passthrough
id='passthrough-12'")):::passthrough
parsecompletion7["parse-completion
id='parse-completion-7'"] -- "math->question" --> mathfunction["prompt-template
id='math-function'"]
parsecompletion7["parse-completion
id='parse-completion-7'"] -- "answer->text" --> output13{{"output
id='output-13'"}}:::output
reactcompletion["text-completion
id='react-completion'"] -- "completion->completion" --> parsecompletion7["parse-completion
id='parse-completion-7'"]
reactcompletion["text-completion
id='react-completion'"] -- "completion->Thought" --> rememberthought["local-memory
id='remember-thought'"]
prompttemplate3["prompt-template
id='prompt-template-3'"] -- "prompt->text" --> reactcompletion["text-completion
id='react-completion'"]
rememberquestion["local-memory
id='remember-question'"] -- "context->memory" --> prompttemplate3["prompt-template
id='prompt-template-3'"]
input6[/"input
id='input-6'"/]:::input -- "text->Question" --> rememberquestion["local-memory
id='remember-question'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
templateprompttemplate3[template]:::config -- "template->template" --o prompttemplate3
stopsequencesreactcompletion[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o reactcompletion
templatemathfunction[template]:::config -- "template->template" --o mathfunction
namecompute[name]:::config -- "name->name" --o compute
messageinput6[message]:::config -- "message->message" --o input6
argsparsecompletion7[args]:::config -- "args->args" --o parsecompletion7
restparsecompletion7[rest]:::config -- "rest->rest" --o parsecompletion7
templatesummarizingtemplate[template]:::config -- "template->template" --o summarizingtemplate
templateurl_template9[template]:::config -- "template->template" --o url_template9
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