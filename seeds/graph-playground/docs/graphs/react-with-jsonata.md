# react-with-jsonata
---

```mermaid
%%{init: {'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}}%%
graph TD;
get-tools-object["react-helper
id='get-tools-object'"] -- tools:json --> get-tools["jsonata
id='get-tools'"]
get-tools-object["react-helper
id='get-tools-object'"] -- tools:json --> get-tool-descriptions["jsonata
id='get-tool-descriptions'"]
get-tools["jsonata
id='get-tools'"] -- result:tools --> react-template["prompt-template
id='react-template'"]
get-tool-descriptions["jsonata
id='get-tool-descriptions'"] -- result:descriptions --> react-template["prompt-template
id='react-template'"]
ask-user[/"input
id='ask-user'"/]:::input -. text:text .-> pass(("passthrough
id='pass'")):::passthrough
pass(("passthrough
id='pass'")):::passthrough -. text:Question .-> remember-question["local-memory
id='remember-question'"]
remember-question["local-memory
id='remember-question'"] -- context:memory --> react-template["prompt-template
id='react-template'"]
pass(("passthrough
id='pass'")):::passthrough --> get-tools-object["react-helper
id='get-tools-object'"]
react-template["prompt-template
id='react-template'"] -- prompt:text --> react-completion["text-completion
id='react-completion'"]
react-completion["text-completion
id='react-completion'"] -- completion:completion --> parse-completion["react-helper
id='parse-completion'"]
react-completion["text-completion
id='react-completion'"] -- completion:Thought --> remember-thought["local-memory
id='remember-thought'"]
parse-completion["react-helper
id='parse-completion'"] -- search:text --> search[["include
id='search'"]]:::include
parse-completion["react-helper
id='parse-completion'"] -- math:text --> math[["include
id='math'"]]:::include
math[["include
id='math'"]]:::include -- text:Observation --> remember-observation["local-memory
id='remember-observation'"]
search[["include
id='search'"]]:::include -- text:Observation --> remember-observation["local-memory
id='remember-observation'"]
remember-observation["local-memory
id='remember-observation'"] --> pass(("passthrough
id='pass'")):::passthrough
parse-completion["react-helper
id='parse-completion'"] -- answer:text --> last-print{{"output
id='last-print'"}}:::output
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slotted stroke:#a64d79
```