# react
  - Original: [`react.ts`](../../src/boards/react.ts)
  - Graph: [`react.json`](../../graphs/react.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
getDescriptions4["getDescriptions id='getDescriptions-4'"] -- "descriptions->descriptions" --o promptTemplate3["promptTemplate id='promptTemplate-3'"]
getTools5["getTools id='getTools-5'"] -- "tools->tools" --o promptTemplate3["promptTemplate id='promptTemplate-3'"]
localMemory2["localMemory id='localMemory-2'"] -- "context->memory" --> promptTemplate3["promptTemplate id='promptTemplate-3'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["textCompletion id='react-completion'"]
compute["runJavascript id='compute'"] -- "result->Observation" --> localMemory2["localMemory id='localMemory-2'"]
mathfunctioncompletion["textCompletion id='math-function-completion'"] -- "completion->code" --> compute["runJavascript id='compute'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o mathfunctioncompletion["textCompletion id='math-function-completion'"]
mathfunction["promptTemplate id='math-function'"] -- "prompt->text" --> mathfunctioncompletion["textCompletion id='math-function-completion'"]
textCompletion8["textCompletion id='textCompletion-8'"] -- "completion->Observation" --> localMemory2["localMemory id='localMemory-2'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion8["textCompletion id='textCompletion-8'"]
summarizingtemplate["promptTemplate id='summarizing-template'"] -- "prompt->text" --> textCompletion8["textCompletion id='textCompletion-8'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o urlTemplate9["urlTemplate id='urlTemplate-9'"]
secrets1("secrets id='secrets-1'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --o urlTemplate9["urlTemplate id='urlTemplate-9'"]
jsonata11["jsonata id='jsonata-11'"] -- "result->context" --> summarizingtemplate["promptTemplate id='summarizing-template'"]
fetch10["fetch id='fetch-10'"] -- "response->json" --> jsonata11["jsonata id='jsonata-11'"]
urlTemplate9["urlTemplate id='urlTemplate-9'"] -- "url->url" --> fetch10["fetch id='fetch-10'"]
passthrough12(("passthrough id='passthrough-12'")):::passthrough -- "search->question" --> summarizingtemplate["promptTemplate id='summarizing-template'"]
passthrough12(("passthrough id='passthrough-12'")):::passthrough -- "search->query" --> urlTemplate9["urlTemplate id='urlTemplate-9'"]
parseCompletion7["parseCompletion id='parseCompletion-7'"] -- "search->search" --> passthrough12(("passthrough id='passthrough-12'")):::passthrough
parseCompletion7["parseCompletion id='parseCompletion-7'"] -- "math->question" --> mathfunction["promptTemplate id='math-function'"]
parseCompletion7["parseCompletion id='parseCompletion-7'"] -- "answer->text" --> output13{{"output id='output-13'"}}:::output
reactcompletion["textCompletion id='react-completion'"] -- "completion->completion" --> parseCompletion7["parseCompletion id='parseCompletion-7'"]
reactcompletion["textCompletion id='react-completion'"] -- "completion->Thought" --> rememberthought["localMemory id='remember-thought'"]
promptTemplate3["promptTemplate id='promptTemplate-3'"] -- "prompt->text" --> reactcompletion["textCompletion id='react-completion'"]
rememberquestion["localMemory id='remember-question'"] -- "context->memory" --> promptTemplate3["promptTemplate id='promptTemplate-3'"]
input6[/"input id='input-6'"/]:::input -- "text->Question" --> rememberquestion["localMemory id='remember-question'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
templatepromptTemplate3[template]:::config -- "template->template" --o promptTemplate3
stopsequencesreactcompletion[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o reactcompletion
templatemathfunction[template]:::config -- "template->template" --o mathfunction
namecompute[name]:::config -- "name->name" --o compute
messageinput6[message]:::config -- "message->message" --o input6
argsparseCompletion7[args]:::config -- "args->args" --o parseCompletion7
restparseCompletion7[rest]:::config -- "rest->rest" --o parseCompletion7
templatesummarizingtemplate[template]:::config -- "template->template" --o summarizingtemplate
templateurlTemplate9[template]:::config -- "template->template" --o urlTemplate9
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