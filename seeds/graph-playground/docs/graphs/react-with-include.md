# react-with-include
---

```mermaid
graph TD;
get-tools -- tools:tools --> react-template
get-tool-descriptions -- descriptions:descriptions --> react-template
ask-user[/ask-user/] -. text:text .-> pass((pass))
pass((pass)) --> get-tools
pass((pass)) -. text:Question .-> remember-question
remember-question -- context:memory --> react-template
pass((pass)) --> get-tool-descriptions
react-template -- prompt:text --> react-completion
react-completion -- completion:completion --> parse-completion
react-completion -- completion:Thought --> remember-thought
parse-completion -- search:text --> search[[search]]
parse-completion -- math:text --> math[[math]]
math[[math]] -- text:Observation --> remember-math
remember-math -- context:text --> print{{print}}
search[[search]] -- text:Observation --> remember-search
remember-search -- context:text --> print{{print}}
print{{print}} --> pass((pass))
parse-completion -- answer:text --> last-print{{last-print}}
```