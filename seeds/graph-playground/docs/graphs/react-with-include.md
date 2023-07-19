# react-with-include
  - Original: [`react-with-include.ts`](../../src/boards/react-with-include.ts)
  - Graph: [`react-with-include.json`](../../graphs/react-with-include.json)
  
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
id='secrets-1'"):::secrets -- "API_KEY->API_KEY" --o reactcompletion["text-completion
id='react-completion'"]
include6[["include
id='include-6'"]]:::include -- "text->Observation" --> localmemory2["local-memory
id='local-memory-2'"]
include7[["include
id='include-7'"]]:::include -- "text->Observation" --> localmemory2["local-memory
id='local-memory-2'"]
parsecompletion9["parse-completion
id='parse-completion-9'"] -- "search->text" --> include7[["include
id='include-7'"]]:::include
parsecompletion9["parse-completion
id='parse-completion-9'"] -- "math->text" --> include6[["include
id='include-6'"]]:::include
parsecompletion9["parse-completion
id='parse-completion-9'"] -- "answer->text" --> output10{{"output
id='output-10'"}}:::output
reactcompletion["text-completion
id='react-completion'"] -- "completion->completion" --> parsecompletion9["parse-completion
id='parse-completion-9'"]
reactcompletion["text-completion
id='react-completion'"] -- "completion->Thought" --> rememberthought["local-memory
id='remember-thought'"]
prompttemplate3["prompt-template
id='prompt-template-3'"] -- "prompt->text" --> reactcompletion["text-completion
id='react-completion'"]
rememberquestion["local-memory
id='remember-question'"] -- "context->memory" --> prompttemplate3["prompt-template
id='prompt-template-3'"]
input8[/"input
id='input-8'"/]:::input -- "text->Question" --> rememberquestion["local-memory
id='remember-question'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
templateprompttemplate3[template]:::config -- "template->template" --o prompttemplate3
stopsequencesreactcompletion[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o reactcompletion
$refinclude6[$ref]:::config -- "$ref->$ref" --o include6
$refinclude7[$ref]:::config -- "$ref->$ref" --o include7
messageinput8[message]:::config -- "message->message" --o input8
argsparsecompletion9[args]:::config -- "args->args" --o parsecompletion9
restparsecompletion9[rest]:::config -- "rest->rest" --o parsecompletion9
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```