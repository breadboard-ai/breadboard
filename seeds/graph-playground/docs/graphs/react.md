# react
  - Original: [`react.ts`](../../src/boards/react.ts)
  - Graph: [`react.json`](../../graphs/react.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
getDescriptions3["getDescriptions <br> id='getDescriptions-3'"] -- "descriptions->descriptions" --o promptTemplate2["promptTemplate <br> id='promptTemplate-2'"]
getTools4["getTools <br> id='getTools-4'"] -- "tools->tools" --o promptTemplate2["promptTemplate <br> id='promptTemplate-2'"]
rememberObservation["append <br> id='rememberObservation'"] -- "accumulator->memory" --> promptTemplate2["promptTemplate <br> id='promptTemplate-2'"]
rememberThought["append <br> id='rememberThought'"] -- "accumulator->accumulator" --> rememberObservation["append <br> id='rememberObservation'"]
rememberObservation["append <br> id='rememberObservation'"] -- "accumulator->accumulator" --> rememberThought["append <br> id='rememberThought'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberThought["append <br> id='rememberThought'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->memory" --> promptTemplate2["promptTemplate <br> id='promptTemplate-2'"]
input5[/"input <br> id='input-5'"/]:::input -- "text->Question" --> rememberQuestion["append <br> id='rememberQuestion'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["generateText <br> id='react-completion'"]
compute["runJavascript <br> id='compute'"] -- "result->Observation" --> rememberObservation["append <br> id='rememberObservation'"]
mathfunctioncompletion["generateText <br> id='math-function-completion'"] -- "completion->code" --> compute["runJavascript <br> id='compute'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o mathfunctioncompletion["generateText <br> id='math-function-completion'"]
mathfunction["promptTemplate <br> id='math-function'"] -- "prompt->text" --> mathfunctioncompletion["generateText <br> id='math-function-completion'"]
generateText7["generateText <br> id='generateText-7'"] -- "completion->Observation" --> rememberObservation["append <br> id='rememberObservation'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText7["generateText <br> id='generateText-7'"]
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> generateText7["generateText <br> id='generateText-7'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o urlTemplate8["urlTemplate <br> id='urlTemplate-8'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --o urlTemplate8["urlTemplate <br> id='urlTemplate-8'"]
jsonata10["jsonata <br> id='jsonata-10'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
fetch9["fetch <br> id='fetch-9'"] -- "response->json" --> jsonata10["jsonata <br> id='jsonata-10'"]
urlTemplate8["urlTemplate <br> id='urlTemplate-8'"] -- "url->url" --> fetch9["fetch <br> id='fetch-9'"]
passthrough11(("passthrough <br> id='passthrough-11'")):::passthrough -- "search->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
passthrough11(("passthrough <br> id='passthrough-11'")):::passthrough -- "search->query" --> urlTemplate8["urlTemplate <br> id='urlTemplate-8'"]
parseCompletion6["parseCompletion <br> id='parseCompletion-6'"] -- "search->search" --> passthrough11(("passthrough <br> id='passthrough-11'")):::passthrough
parseCompletion6["parseCompletion <br> id='parseCompletion-6'"] -- "math->question" --> mathfunction["promptTemplate <br> id='math-function'"]
parseCompletion6["parseCompletion <br> id='parseCompletion-6'"] -- "answer->text" --> output12{{"output <br> id='output-12'"}}:::output
reactcompletion["generateText <br> id='react-completion'"] -- "completion->completion" --> parseCompletion6["parseCompletion <br> id='parseCompletion-6'"]
reactcompletion["generateText <br> id='react-completion'"] -- "completion->Thought" --> rememberThought["append <br> id='rememberThought'"]
promptTemplate2["promptTemplate <br> id='promptTemplate-2'"] -- "prompt->text" --> reactcompletion["generateText <br> id='react-completion'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```