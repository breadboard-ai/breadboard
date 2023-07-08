# google-news
---

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input[/"input
id='input'"/]:::input -- text:topic --> summarizeresults["prompt-template
id='summarize-results'"]
input[/"input
id='input'"/]:::input -- text:query --> news_url["url_template
id='news_url'"]
news_url["url_template
id='news_url'"] -- url:url --> fetch["fetch
id='fetch'"]
fetch["fetch
id='fetch'"] -- response:xml --> xmltojson["xml_to_json
id='xml-to-json'"]
xmltojson["xml_to_json
id='xml-to-json'"] -- json:json --> headlines["jsonata
id='headlines'"]
headlines["jsonata
id='headlines'"] -- result:headlines --> summarizeresults["prompt-template
id='summarize-results'"]
secrets("secrets
id='secrets'"):::secrets -- API_KEY:API_KEY --> textcompletion1["text-completion
id='text-completion-1'"]
summarizeresults["prompt-template
id='summarize-results'"] -- prompt:text --> textcompletion1["text-completion
id='text-completion-1'"]
textcompletion1["text-completion
id='text-completion-1'"] -- completion:text --> print{{"output
id='print'"}}:::output
messageinput[message]:::config -- message:message --o input
rawfetch[raw]:::config -- raw:raw --o fetch
templatenews_url[template]:::config -- template:template --o news_url
expressionheadlines[expression]:::config -- expression:expression --o headlines
templatesummarizeresults[template]:::config -- template:template --o summarizeresults
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```