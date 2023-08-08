# react-with-include
  - Original: [`react-with-include.ts`](../../src/boards/react-with-include.ts)
  - Graph: [`react-with-include.json`](../../graphs/react-with-include.json)
  
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
include6[["include <br> id='include-6'"]]:::include -- "text->Observation" --> rememberObservation["append <br> id='rememberObservation'"]
include7[["include <br> id='include-7'"]]:::include -- "text->Observation" --> rememberObservation["append <br> id='rememberObservation'"]
parseCompletion8["parseCompletion <br> id='parseCompletion-8'"] -- "search->text" --> include7[["include <br> id='include-7'"]]:::include
parseCompletion8["parseCompletion <br> id='parseCompletion-8'"] -- "math->text" --> include6[["include <br> id='include-6'"]]:::include
parseCompletion8["parseCompletion <br> id='parseCompletion-8'"] -- "answer->text" --> output9{{"output <br> id='output-9'"}}:::output
reactcompletion["generateText <br> id='react-completion'"] -- "completion->completion" --> parseCompletion8["parseCompletion <br> id='parseCompletion-8'"]
reactcompletion["generateText <br> id='react-completion'"] -- "completion->Thought" --> rememberThought["append <br> id='rememberThought'"]
promptTemplate2["promptTemplate <br> id='promptTemplate-2'"] -- "prompt->text" --> reactcompletion["generateText <br> id='react-completion'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
templatepromptTemplate2[template]:::config -- "template->template" --o promptTemplate2
messageinput5[message]:::config -- "message->message" --o input5
stopSequencesreactcompletion[stopSequences]:::config -- "stopSequences->stopSequences" --o reactcompletion
$refinclude6[$ref]:::config -- "$ref->$ref" --o include6
$refinclude7[$ref]:::config -- "$ref->$ref" --o include7
argsparseCompletion8[args]:::config -- "args->args" --o parseCompletion8
restparseCompletion8[rest]:::config -- "rest->rest" --o parseCompletion8
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```