# Coffee Bot

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
tools(("passthrough <br> id='tools'")):::passthrough -- "tools->tools" --> botprompt["promptTemplate <br> id='bot-prompt'"]
format(("passthrough <br> id='format'")):::passthrough -- "format->format" --> botprompt["promptTemplate <br> id='bot-prompt'"]
append1["append <br> id='append-1'"] -- "accumulator->bot" --> output2{{"output <br> id='output-2'"}}:::output
checkMenu["runJavascript <br> id='checkMenu'"] -- "result->Tool" --> append1["append <br> id='append-1'"]
toolRouter["runJavascript <br> id='toolRouter'"] -- "customer->bot" --> output3{{"output <br> id='output-3'"}}:::output
toolRouter["runJavascript <br> id='toolRouter'"] -- "checkMenu->checkMenu" --> checkMenu["runJavascript <br> id='checkMenu'"]
generateText5["generateText <br> id='generateText-5'"] -- "completion->completion" --> toolRouter["runJavascript <br> id='toolRouter'"]
generateText5["generateText <br> id='generateText-5'"] -- "filters->filters" --> blocked{{"output <br> id='blocked'"}}:::output
secrets6("secrets <br> id='secrets-6'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText5["generateText <br> id='generateText-5'"]
botprompt["promptTemplate <br> id='bot-prompt'"] -- "prompt->text" --> generateText5["generateText <br> id='generateText-5'"]
input4[/"input <br> id='input-4'"/]:::input -- "customer->customer" --> botprompt["promptTemplate <br> id='bot-prompt'"]
templatebotprompt[template]:::config -- "template->template" --o botprompt
toolstools[tools]:::config -- "tools->tools" --o tools
formatformat[format]:::config -- "format->format" --o format
namecheckMenu[name]:::config -- "name->name" --o checkMenu
codecheckMenu[code]:::config -- "code->code" --o checkMenu
nametoolRouter[name]:::config -- "name->name" --o toolRouter
codetoolRouter[code]:::config -- "code->code" --o toolRouter
rawtoolRouter[raw]:::config -- "raw->raw" --o toolRouter
stopSequencesgenerateText5[stopSequences]:::config -- "stopSequences->stopSequences" --o generateText5
safetySettingsgenerateText5[safetySettings]:::config -- "safetySettings->safetySettings" --o generateText5
keyssecrets6[keys]:::config -- "keys->keys" --o secrets6
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```