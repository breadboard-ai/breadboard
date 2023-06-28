# search-summarize
---

```mermaid
graph TD;
input[/"input
id='input'"/]:::input -- text:text --> pass(("passthrough
id='pass'")):::passthrough
pass(("passthrough
id='pass'")):::passthrough -- text:query --> search["google-search
id='search'"]
pass(("passthrough
id='pass'")):::passthrough -- text:question --> summarize-results["prompt-template
id='summarize-results'"]
search["google-search
id='search'"] -- results:context --> summarize-results["prompt-template
id='summarize-results'"]
summarize-results["prompt-template
id='summarize-results'"] -- prompt:text --> text-completion-1["text-completion
id='text-completion-1'"]
text-completion-1["text-completion
id='text-completion-1'"] -- completion:text --> print{{"output
id='print'"}}:::output
```