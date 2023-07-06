# endless-debate-with-voice
---

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
debatetopic[/"input
id='debate-topic'"/]:::input -- text:topic --> localmemory1["local-memory
id='local-memory-1'"]
localmemory1["local-memory
id='local-memory-1'"] -- context:context --> albert["prompt-template
id='albert'"]
albert["prompt-template
id='albert'"] -- prompt:text --> albertcompletion["text-completion
id='albert-completion'"]
albertcompletion["text-completion
id='albert-completion'"] -- completion:context --> albertvoice["prompt-template
id='albert-voice'"]
albertvoice["prompt-template
id='albert-voice'"] -- prompt:text --> albertvoicecompletion["text-completion
id='albert-voice-completion'"]
albertvoicecompletion["text-completion
id='albert-voice-completion'"] -- completion:text --> output1{{"output
id='output-1'"}}:::output
albertcompletion["text-completion
id='albert-completion'"] -- completion:Albert --> localmemory2["local-memory
id='local-memory-2'"]
localmemory2["local-memory
id='local-memory-2'"] -- context:context --> friedrich["prompt-template
id='friedrich'"]
friedrich["prompt-template
id='friedrich'"] -- prompt:text --> friedrichcompletion["text-completion
id='friedrich-completion'"]
friedrichcompletion["text-completion
id='friedrich-completion'"] -- completion:context --> friedrichvoice["prompt-template
id='friedrich-voice'"]
friedrichvoice["prompt-template
id='friedrich-voice'"] -- prompt:text --> friedrichvoicecompletion["text-completion
id='friedrich-voice-completion'"]
friedrichvoicecompletion["text-completion
id='friedrich-voice-completion'"] -- completion:text --> output1{{"output
id='output-1'"}}:::output
friedrichcompletion["text-completion
id='friedrich-completion'"] -- completion:Friedrich --> localmemory3["local-memory
id='local-memory-3'"]
localmemory3["local-memory
id='local-memory-3'"] -- context:context --> albert["prompt-template
id='albert'"]
messagedebatetopic[message]:::config --o debatetopic
stopsequencesalbertcompletion[stop-sequences]:::config --o albertcompletion
stopsequencesfriedrichcompletion[stop-sequences]:::config --o friedrichcompletion
templatealbert[template]:::config --o albert
templatefriedrich[template]:::config --o friedrich
templatefriedrichvoice[template]:::config --o friedrichvoice
templatealbertvoice[template]:::config --o albertvoice
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slotted stroke:#a64d79
```