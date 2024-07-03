# Running Breadboard in Colab

--
layout: docs.njk
title: Running Breadboard in Colab
tags:
  - python
  - colab
  - wip
---

If you're looking to run Breadboard with a Python runtime, one way is to embed Breadboard into a Colab notebook.

## Getting started

First, navigate to Google's Colab at https://colab.research.google.com/ and open or create a notebook.

Then, you can install a the breadboard colab package into your runtime with the following:

```python
!pip install breadboard_colab
```

Afterwards, to run an iframed Breadboard instance, run the following command:

```python
from colab import start_breadboard_iframe

# Replace URL if a different Breadboard endpoint is desired.
# breadboard-ai.web.app is the default value if none is entered.
colab.start_breadboard_iframe("https://breadboard-ai.web.app/")
```

This will create an instance of the Breadboard in an iframe.

![Starting a Breadboard instance in colab](/breadboard/static/images/colab/starting-iframe.png)

## Running Python

Within this breadboard instance, any runPython nodes will be executed using the
colab runtime the notebook is attached to. This means that any Python code that
runs in a particular colab runtime can also be ran by breadboard when embedded
into that particular runtime.

Note: Similar to colab notebooks, this does make Breadboards with specific
dependencies less portable, because it is specific to a particular runtime.


### Inputs/outputs
-   RunPython execution on the colab runtime will see and affect global
    variables, similar to if the Python code was executed in a colab cell.
-   This means that variables set by one runPython node will be seen by the next
    one.


Breadboard graphs can also pass in inputs into runPython nodes. Because and
input/output values are JSON serializable, they can be passed between Python
and Javascript nodes.

At the beginning of the runPython execution, the breadboard inputs will be
injected into the Python map of global variables, overwriting any existing
values set by those keys.

From breadboard output, only json serializable outputs that change are emitted.
