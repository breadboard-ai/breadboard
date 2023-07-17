# endless-debate-with-voice
  - Original: [`endless-debate-with-voice.ts`](../../src/boards/endless-debate-with-voice.ts)
  - Graph: [`endless-debate-with-voice.json`](../../graphs/endless-debate-with-voice.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
localmemory5["local-memory
id='local-memory-5'"] -- "context->context" --> prompttemplate3["prompt-template
id='prompt-template-3'"]
textcompletion4["text-completion
id='text-completion-4'"] -- "completion->Albert" --> localmemory5["local-memory
id='local-memory-5'"]
secrets2("secrets
id='secrets-2'"):::secrets -- "API_KEY->API_KEY" --o textcompletion6["text-completion
id='text-completion-6'"]
textcompletion6["text-completion
id='text-completion-6'"] -- "completion->text" --> output7{{"output
id='output-7'"}}:::output
albertvoice["prompt-template
id='albert-voice'"] -- "prompt->text" --> textcompletion6["text-completion
id='text-completion-6'"]
textcompletion4["text-completion
id='text-completion-4'"] -- "completion->context" --> albertvoice["prompt-template
id='albert-voice'"]
secrets2("secrets
id='secrets-2'"):::secrets -- "API_KEY->API_KEY" --o textcompletion4["text-completion
id='text-completion-4'"]
albert["prompt-template
id='albert'"] -- "prompt->text" --> textcompletion4["text-completion
id='text-completion-4'"]
localmemory9["local-memory
id='local-memory-9'"] -- "context->context" --> albert["prompt-template
id='albert'"]
textcompletion8["text-completion
id='text-completion-8'"] -- "completion->Friedrich" --> localmemory9["local-memory
id='local-memory-9'"]
secrets2("secrets
id='secrets-2'"):::secrets -- "API_KEY->API_KEY" --o textcompletion10["text-completion
id='text-completion-10'"]
textcompletion10["text-completion
id='text-completion-10'"] -- "completion->text" --> output11{{"output
id='output-11'"}}:::output
friedrichvoice["prompt-template
id='friedrich-voice'"] -- "prompt->text" --> textcompletion10["text-completion
id='text-completion-10'"]
textcompletion8["text-completion
id='text-completion-8'"] -- "completion->context" --> friedrichvoice["prompt-template
id='friedrich-voice'"]
secrets2("secrets
id='secrets-2'"):::secrets -- "API_KEY->API_KEY" --o textcompletion8["text-completion
id='text-completion-8'"]
prompttemplate3["prompt-template
id='prompt-template-3'"] -- "prompt->text" --> textcompletion8["text-completion
id='text-completion-8'"]
localmemory1["local-memory
id='local-memory-1'"] -- "context->context" --> albert["prompt-template
id='albert'"]
input12[/"input
id='input-12'"/]:::input -- "text->topic" --> localmemory1["local-memory
id='local-memory-1'"]
keyssecrets2[keys]:::config -- "keys->keys" --o secrets2
templateprompttemplate3[template]:::config -- "template->template" --o prompttemplate3
templatealbert[template]:::config -- "template->template" --o albert
stopsequencestextcompletion4[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textcompletion4
templatealbertvoice[template]:::config -- "template->template" --o albertvoice
stopsequencestextcompletion8[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textcompletion8
templatefriedrichvoice[template]:::config -- "template->template" --o friedrichvoice
messageinput12[message]:::config -- "message->message" --o input12
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```