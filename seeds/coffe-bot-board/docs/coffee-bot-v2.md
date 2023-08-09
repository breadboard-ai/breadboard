# Coffee Bot

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
tools(("passthrough <br> id='tools'")):::passthrough -- "tools->tools" --> botprompt["promptTemplate <br> id='bot-prompt'"]
format(("passthrough <br> id='format'")):::passthrough -- "format->format" --> botprompt["promptTemplate <br> id='bot-prompt'"]
append2["append <br> id='append-2'"] -- "accumulator->bot" --> output3{{"output <br> id='output-3'"}}:::output
runJavascript1["runJavascript <br> id='runJavascript-1'"] -- "result->Tool" --> append2["append <br> id='append-2'"]
runJavascript4["runJavascript <br> id='runJavascript-4'"] -- "customer->bot" --> output5{{"output <br> id='output-5'"}}:::output
runJavascript4["runJavascript <br> id='runJavascript-4'"] -- "checkMenu->checkMenu" --> runJavascript1["runJavascript <br> id='runJavascript-1'"]
generateText7["generateText <br> id='generateText-7'"] -- "completion->completion" --> runJavascript4["runJavascript <br> id='runJavascript-4'"]
generateText7["generateText <br> id='generateText-7'"] -- "filters->filters" --> blocked{{"output <br> id='blocked'"}}:::output
secrets8("secrets <br> id='secrets-8'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText7["generateText <br> id='generateText-7'"]
botprompt["promptTemplate <br> id='bot-prompt'"] -- "prompt->text" --> generateText7["generateText <br> id='generateText-7'"]
input6[/"input <br> id='input-6'"/]:::input -- "customer->customer" --> botprompt["promptTemplate <br> id='bot-prompt'"]
templatebotprompt[template]:::config -- "template->template" --o botprompt
toolstools[tools]:::config -- "tools->tools" --o tools
formatformat[format]:::config -- "format->format" --o format
namerunJavascript1[name]:::config -- "name->name" --o runJavascript1
coderunJavascript1[code]:::config -- "code->code" --o runJavascript1
namerunJavascript4[name]:::config -- "name->name" --o runJavascript4
coderunJavascript4[code]:::config -- "code->code" --o runJavascript4
rawrunJavascript4[raw]:::config -- "raw->raw" --o runJavascript4
stopSequencesgenerateText7[stopSequences]:::config -- "stopSequences->stopSequences" --o generateText7
safetySettingsgenerateText7[safetySettings]:::config -- "safetySettings->safetySettings" --o generateText7
keyssecrets8[keys]:::config -- "keys->keys" --o secrets8
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```