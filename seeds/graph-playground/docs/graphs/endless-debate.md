# endless-debate
  - Original: [`endless-debate.ts`](../../src/boards/endless-debate.ts)
  - Graph: [`endless-debate.json`](../../graphs/endless-debate.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
localmemory5["local-memory
id='local-memory-5'"] -- "context->context" --> prompttemplate3["prompt-template
id='prompt-template-3'"]
textcompletion4["text-completion
id='text-completion-4'"] -- "completion->Albert" --> localmemory5["local-memory
id='local-memory-5'"]
textcompletion4["text-completion
id='text-completion-4'"] -- "completion->text" --> output6{{"output
id='output-6'"}}:::output
secrets2("secrets
id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o textcompletion4["text-completion
id='text-completion-4'"]
albert["prompt-template
id='albert'"] -- "prompt->text" --> textcompletion4["text-completion
id='text-completion-4'"]
localmemory8["local-memory
id='local-memory-8'"] -- "context->context" --> albert["prompt-template
id='albert'"]
textcompletion7["text-completion
id='text-completion-7'"] -- "completion->Friedrich" --> localmemory8["local-memory
id='local-memory-8'"]
textcompletion7["text-completion
id='text-completion-7'"] -- "completion->text" --> output9{{"output
id='output-9'"}}:::output
secrets2("secrets
id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o textcompletion7["text-completion
id='text-completion-7'"]
prompttemplate3["prompt-template
id='prompt-template-3'"] -- "prompt->text" --> textcompletion7["text-completion
id='text-completion-7'"]
localmemory1["local-memory
id='local-memory-1'"] -- "context->context" --> albert["prompt-template
id='albert'"]
input10[/"input
id='input-10'"/]:::input -- "text->topic" --> localmemory1["local-memory
id='local-memory-1'"]
keyssecrets2[keys]:::config -- "keys->keys" --o secrets2
templateprompttemplate3[template]:::config -- "template->template" --o prompttemplate3
templatealbert[template]:::config -- "template->template" --o albert
stopsequencestextcompletion4[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textcompletion4
stopsequencestextcompletion7[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textcompletion7
messageinput10[message]:::config -- "message->message" --o input10
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```