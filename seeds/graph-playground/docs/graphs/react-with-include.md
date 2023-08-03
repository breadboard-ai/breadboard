# react-with-include
  - Original: [`react-with-include.ts`](../../src/boards/react-with-include.ts)
  - Graph: [`react-with-include.json`](../../graphs/react-with-include.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
getDescriptions4["getDescriptions id='getDescriptions-4'"] -- "descriptions->descriptions" --o promptTemplate3["promptTemplate id='promptTemplate-3'"]
getTools5["getTools id='getTools-5'"] -- "tools->tools" --o promptTemplate3["promptTemplate id='promptTemplate-3'"]
localMemory2["localMemory id='localMemory-2'"] -- "context->memory" --> promptTemplate3["promptTemplate id='promptTemplate-3'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["textCompletion id='react-completion'"]
include6[["include id='include-6'"]]:::include -- "text->Observation" --> localMemory2["localMemory id='localMemory-2'"]
include7[["include id='include-7'"]]:::include -- "text->Observation" --> localMemory2["localMemory id='localMemory-2'"]
parseCompletion9["parseCompletion id='parseCompletion-9'"] -- "search->text" --> include7[["include id='include-7'"]]:::include
parseCompletion9["parseCompletion id='parseCompletion-9'"] -- "math->text" --> include6[["include id='include-6'"]]:::include
parseCompletion9["parseCompletion id='parseCompletion-9'"] -- "answer->text" --> output10{{"output id='output-10'"}}:::output
reactcompletion["textCompletion id='react-completion'"] -- "completion->completion" --> parseCompletion9["parseCompletion id='parseCompletion-9'"]
reactcompletion["textCompletion id='react-completion'"] -- "completion->Thought" --> rememberthought["localMemory id='remember-thought'"]
promptTemplate3["promptTemplate id='promptTemplate-3'"] -- "prompt->text" --> reactcompletion["textCompletion id='react-completion'"]
rememberquestion["localMemory id='remember-question'"] -- "context->memory" --> promptTemplate3["promptTemplate id='promptTemplate-3'"]
input8[/"input id='input-8'"/]:::input -- "text->Question" --> rememberquestion["localMemory id='remember-question'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
templatepromptTemplate3[template]:::config -- "template->template" --o promptTemplate3
stopsequencesreactcompletion[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o reactcompletion
$refinclude6[$ref]:::config -- "$ref->$ref" --o include6
$refinclude7[$ref]:::config -- "$ref->$ref" --o include7
messageinput8[message]:::config -- "message->message" --o input8
argsparseCompletion9[args]:::config -- "args->args" --o parseCompletion9
restparseCompletion9[rest]:::config -- "rest->rest" --o parseCompletion9
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```