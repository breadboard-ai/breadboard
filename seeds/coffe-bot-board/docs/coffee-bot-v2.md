# Coffee Bot

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
tools(("passthrough <br> id='tools'")):::passthrough -- "tools->tools" --> botprompt["promptTemplate <br> id='bot-prompt'"]
format(("passthrough <br> id='format'")):::passthrough -- "format->format" --> botprompt["promptTemplate <br> id='bot-prompt'"]
generateText2["generateText <br> id='generateText-2'"] -- "completion->completion" --> completion{{"output <br> id='completion'"}}:::output
generateText2["generateText <br> id='generateText-2'"] -- "filters->filters" --> blocked{{"output <br> id='blocked'"}}:::output
secrets3("secrets <br> id='secrets-3'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText2["generateText <br> id='generateText-2'"]
botprompt["promptTemplate <br> id='bot-prompt'"] -- "prompt->text" --> generateText2["generateText <br> id='generateText-2'"]
passthrough4(("passthrough <br> id='passthrough-4'")):::passthrough -- "memory->memory" --> botprompt["promptTemplate <br> id='bot-prompt'"]
input1[/"input <br> id='input-1'"/]:::input -- "customer->customer" --> botprompt["promptTemplate <br> id='bot-prompt'"]
templatebotprompt[template]:::config -- "template->template" --o botprompt
toolstools[tools]:::config -- "tools->tools" --o tools
formatformat[format]:::config -- "format->format" --o format
stopSequencesgenerateText2[stopSequences]:::config -- "stopSequences->stopSequences" --o generateText2
safetySettingsgenerateText2[safetySettings]:::config -- "safetySettings->safetySettings" --o generateText2
keyssecrets3[keys]:::config -- "keys->keys" --o secrets3
memorypassthrough4[memory]:::config -- "memory->memory" --o passthrough4
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```