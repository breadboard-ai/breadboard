# react
---

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
gettools["react-helper
id='get-tools'"] -- tools:tools --o reacttemplate["prompt-template
id='react-template'"]
gettooldescriptions["react-helper
id='get-tool-descriptions'"] -- descriptions:descriptions --o reacttemplate["prompt-template
id='react-template'"]
askuser[/"input
id='ask-user'"/]:::input -- text:Question --> rememberquestion["local-memory
id='remember-question'"]
rememberquestion["local-memory
id='remember-question'"] -- context:memory --> reacttemplate["prompt-template
id='react-template'"]
reacttemplate["prompt-template
id='react-template'"] -- prompt:text --> reactcompletion["text-completion
id='react-completion'"]
reactcompletion["text-completion
id='react-completion'"] -- completion:completion --> parsecompletion["react-helper
id='parse-completion'"]
reactcompletion["text-completion
id='react-completion'"] -- completion:Thought --> rememberthought["local-memory
id='remember-thought'"]
parsecompletion["react-helper
id='parse-completion'"] -- search:query --> search["google-search
id='search'"]
parsecompletion["react-helper
id='parse-completion'"] -- math:question --> mathfunction["prompt-template
id='math-function'"]
parsecompletion["react-helper
id='parse-completion'"] -- search:question --> summarizeresults["prompt-template
id='summarize-results'"]
search["google-search
id='search'"] -- results:context --> summarizeresults["prompt-template
id='summarize-results'"]
summarizeresults["prompt-template
id='summarize-results'"] -- prompt:text --> summarizecompletion["text-completion
id='summarize-completion'"]
mathfunction["prompt-template
id='math-function'"] -- prompt:text --> mathfunctioncompletion["text-completion
id='math-function-completion'"]
mathfunctioncompletion["text-completion
id='math-function-completion'"] -- completion:code --> compute["run-javascript
id='compute'"]
compute["run-javascript
id='compute'"] -- result:Observation --> rememberobservation["local-memory
id='remember-observation'"]
summarizecompletion["text-completion
id='summarize-completion'"] -- completion:Observation --> rememberobservation["local-memory
id='remember-observation'"]
rememberobservation["local-memory
id='remember-observation'"] -- context:memory --> reacttemplate["prompt-template
id='react-template'"]
parsecompletion["react-helper
id='parse-completion'"] -- answer:text --> lastprint{{"output
id='last-print'"}}:::output
templatereacttemplate[template]:::config --o reacttemplate
messageaskuser[message]:::config --o askuser
stopsequencesreactcompletion[stop-sequences]:::config --o reactcompletion
methodgettools[method]:::config --o gettools
methodgettooldescriptions[method]:::config --o gettooldescriptions
methodparsecompletion[method]:::config --o parsecompletion
argsparsecompletion[args]:::config --o parsecompletion
templatesummarizeresults[template]:::config --o summarizeresults
messagemathquestion[message]:::config --o mathquestion
templatemathfunction[template]:::config --o mathfunction
namecompute[name]:::config --o compute
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slotted stroke:#a64d79
```