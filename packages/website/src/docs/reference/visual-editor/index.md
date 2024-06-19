---
layout: docs.njk
title: Visual Editor Reference
tags:
  - reference
  - wip
---

## One-time set up

[Breadboard visual editor](https://breadboard-ai.web.app/) is a very flexible tool, and it can be used for many other purposes than just working with Agent Kit. To get the visual editor really honed in for the Agent Kit work, we will want to flip a few settings. To do so, click on the "gear" icon on the top right of the visual editor.

![Settings panel](/breadboard/static/images/agent-kit/settings-panel.png)

In the "General" section of the settings:

- Check _"Hide Embedded Board Selector When Empty"_. The embedded boards are super-cool, but they are a bit of an advanced use case.

- Check _"Hide Advanced Ports on Nodes"_. This will remove some of the options that aren't useful when playing with the Agent Kit.

- Check _"Show Node Shortcuts"_. This will make adding new workers super-easy by adding them as shortcuts at the left bottom part of the visual editor.

In the "Secrets" section:

- Create a "`GEMINI_KEY`" key and put your Gemini API key as the value. This value will be stored locally only and won't be shared with anyone other than the Gemini API.

![Secrets panel](/breadboard/static/images/agent-kit/secrets-panel.png)

Finally, in the "Inputs" section, create a "`model`" key and put in the name of the [Gemini model](https://ai.google.dev/gemini-api/docs/models/gemini#model-variations) to be used by the Workers. Otherwise, the workers will keep asking you for the model every time they want to use one. We recommend either `gemini-1.5-flash-latest` or `gemini-1.5-pro-latest`.

![Inputs panel](/breadboard/static/images/agent-kit/inputs-panel.png)

## Creating a new board

To create a new board, open the left side panel and click on the "New Board" button. You will be asked to name the board. Pick a name that's descriptive, yet concise. All boards are stored as JSON files in the common Breadboard Graph Language (BGL) format.

![New Board](/breadboard/static/images/agent-kit/new-board.png)
