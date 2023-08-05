# react
  - Original: [`react.ts`](../../src/boards/react.ts)
  - Graph: [`react.json`](../../graphs/react.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
getDescriptions3["getDescriptions id='getDescriptions-3'"] -- "descriptions->descriptions" --o promptTemplate2["promptTemplate id='promptTemplate-2'"]
getTools4["getTools id='getTools-4'"] -- "tools->tools" --o promptTemplate2["promptTemplate id='promptTemplate-2'"]
rememberObservation["append id='rememberObservation'"] -- "accumulator->memory" --> promptTemplate2["promptTemplate id='promptTemplate-2'"]
rememberThought["append id='rememberThought'"] -- "accumulator->accumulator" --> rememberObservation["append id='rememberObservation'"]
rememberObservation["append id='rememberObservation'"] -- "accumulator->accumulator" --> rememberThought["append id='rememberThought'"]
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberThought["append id='rememberThought'"]
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->memory" --> promptTemplate2["promptTemplate id='promptTemplate-2'"]
input5[/"input id='input-5'"/]:::input -- "text->Question" --> rememberQuestion["append id='rememberQuestion'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["generateText id='react-completion'"]
compute["runJavascript id='compute'"] -- "result->Observation" --> rememberObservation["append id='rememberObservation'"]
mathfunctioncompletion["generateText id='math-function-completion'"] -- "completion->code" --> compute["runJavascript id='compute'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o mathfunctioncompletion["generateText id='math-function-completion'"]
mathfunction["promptTemplate id='math-function'"] -- "prompt->text" --> mathfunctioncompletion["generateText id='math-function-completion'"]
generateText7["generateText id='generateText-7'"] -- "completion->Observation" --> rememberObservation["append id='rememberObservation'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText7["generateText id='generateText-7'"]
summarizingtemplate["promptTemplate id='summarizing-template'"] -- "prompt->text" --> generateText7["generateText id='generateText-7'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o urlTemplate8["urlTemplate id='urlTemplate-8'"]
secrets1("secrets id='secrets-1'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --o urlTemplate8["urlTemplate id='urlTemplate-8'"]
jsonata10["jsonata id='jsonata-10'"] -- "result->context" --> summarizingtemplate["promptTemplate id='summarizing-template'"]
fetch9["fetch id='fetch-9'"] -- "response->json" --> jsonata10["jsonata id='jsonata-10'"]
urlTemplate8["urlTemplate id='urlTemplate-8'"] -- "url->url" --> fetch9["fetch id='fetch-9'"]
passthrough11(("passthrough id='passthrough-11'")):::passthrough -- "search->question" --> summarizingtemplate["promptTemplate id='summarizing-template'"]
passthrough11(("passthrough id='passthrough-11'")):::passthrough -- "search->query" --> urlTemplate8["urlTemplate id='urlTemplate-8'"]
parseCompletion6["parseCompletion id='parseCompletion-6'"] -- "search->search" --> passthrough11(("passthrough id='passthrough-11'")):::passthrough
parseCompletion6["parseCompletion id='parseCompletion-6'"] -- "math->question" --> mathfunction["promptTemplate id='math-function'"]
parseCompletion6["parseCompletion id='parseCompletion-6'"] -- "answer->text" --> output12{{"output id='output-12'"}}:::output
reactcompletion["generateText id='react-completion'"] -- "completion->completion" --> parseCompletion6["parseCompletion id='parseCompletion-6'"]
reactcompletion["generateText id='react-completion'"] -- "completion->Thought" --> rememberThought["append id='rememberThought'"]
promptTemplate2["promptTemplate id='promptTemplate-2'"] -- "prompt->text" --> reactcompletion["generateText id='react-completion'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
templatepromptTemplate2[template]:::config -- "template->template" --o promptTemplate2
messageinput5[message]:::config -- "message->message" --o input5
stopsequencesreactcompletion[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o reactcompletion
templatemathfunction[template]:::config -- "template->template" --o mathfunction
namecompute[name]:::config -- "name->name" --o compute
argsparseCompletion6[args]:::config -- "args->args" --o parseCompletion6
restparseCompletion6[rest]:::config -- "rest->rest" --o parseCompletion6
templatesummarizingtemplate[template]:::config -- "template->template" --o summarizingtemplate
templateurlTemplate8[template]:::config -- "template->template" --o urlTemplate8
expressionjsonata10[expression]:::config -- "expression->expression" --o jsonata10
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```