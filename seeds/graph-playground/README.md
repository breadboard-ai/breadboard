# Playing with graphs and nodes

To join the fun:

:one: create `.env` file with the following content:

```bash
API_KEY=your_api_key
```

:two: start playing. Here are some examples:

```bash

# Just [input] -> [completion] -> [output]
node . graphs/simplest.json

# Adds a template:
# [input] -> [template] -> [completion] -> [output]
node . graphs/simple-prompt.json

## Uses config to run without asking for input
node . graphs/auto-simple-prompt.json

```
