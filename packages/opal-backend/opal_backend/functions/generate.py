# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Generate function group for the agent loop.

Port of ``functions/generate.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Currently provides ``generate_text``,
the core text-generation function that makes a sub-call to Gemini.

The handler flow:
1. ``from_pidgin_string(prompt)`` — resolve ``<file>`` tags to data parts
2. Build Gemini body with system instruction, contents, and grounding tools
3. ``conform_body(body)`` — resolve ``storedData``/``fileData`` parts
4. ``stream_generate_content(model, body)`` — stream from Gemini
5. Merge text parts from the response
6. Return the merged text
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

from ..agent_file_system import AgentFileSystem
from ..conform_body import conform_body
from ..backend_client import BackendClient
from ..error_classifier import to_error_or_response

from ..function_definition import (
    FunctionDefinition,
    FunctionGroup,
    map_definitions,
)
from ..gemini_client import stream_generate_content
from ..pidgin import content_to_pidgin_string, from_pidgin_string
from ..task_tree_manager import TaskTreeManager
from ..shared_schemas import (
    STATUS_UPDATE_SCHEMA,
    TASK_ID_SCHEMA,
)

logger = logging.getLogger(__name__)

export = ["get_generate_function_group", "GENERATE_TEXT_FUNCTION"]

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GENERATE_TEXT_FUNCTION = "generate_text"
GENERATE_AND_EXECUTE_CODE_FUNCTION = "generate_and_execute_code"

FLASH_MODEL_NAME = "gemini-3-flash-preview"
PRO_MODEL_NAME = "gemini-3.1-pro-preview"
LITE_MODEL_NAME = "gemini-2.5-flash-lite"

# The default system instruction for generate_text sub-calls.
# Matches ``defaultSystemInstruction()`` from generate-text/system-instruction.ts.
DEFAULT_SYSTEM_INSTRUCTION = {
    "parts": [
        {
            "text": (
                "You are working as part of an AI system, so no chit-chat "
                "and no explaining what you're doing and why.\n"
                'DO NOT start with "Okay", or "Alright" or any preambles. '
                "Just the output, please."
            )
        }
    ],
    "role": "user",
}

# The instruction that tells the outer agent when to use generate_text.
# Port of the ``instruction`` template literal from generate.ts.
_INSTRUCTION = f"""

## When to call "{GENERATE_TEXT_FUNCTION}" function

When evaluating the objective, make sure to determine whether calling \
"{GENERATE_TEXT_FUNCTION}" function is warranted. The key tradeoff here is \
latency: because it's an additional model call, the "generate_text" will \
take longer to finish.

Your job is to fulfill the objective as efficiently as possible, so weigh \
the need to invoke "{GENERATE_TEXT_FUNCTION}" carefully.

Here is the rules of thumb:

- For shorter responses like a chat conversation, just do the text \
generation yourself. You are an LLM and you can do it without calling \
"{GENERATE_TEXT_FUNCTION}" function.
- For longer responses like generating a chapter of a book or analyzing a \
large and complex set of files, use "{GENERATE_TEXT_FUNCTION}" function.


### How to write a good prompt for the code generator

The "{GENERATE_AND_EXECUTE_CODE_FUNCTION}" function is a self-contained \
code generator with a sandboxed code execution environment. Think of it as \
a sub-agent that both generates the code and executes it, then provides \
the result. This sub-agent takes a natural language prompt to do its job.

A good code generator prompt will include the following components:

1. Preference for the Python library to use. For example "Use the \
reportlab library to generate PDF"

2. What to consume as input. Focus on the "what", rather than the "how". \
When binary files are passed as input, use the key words "use provided \
file". Do NOT refer to file paths, see below.

3. The high-level approach to solving the problem with code. If \
applicable, specify algorithms or techniques to use.

4. What to deliver as output. Again, do not worry about the "how", \
instead specify the "what". For text files, use the key word "return" in \
the prompt. For binary files, use the key word word "save". For example, \
"Return the resulting number" or "Save the PDF file" or "Save all four \
resulting images". Do NOT ask to name the files, see below.

The code generator prompt may include references to files and it may \
output references to files. However, theses references are translated at \
the boundary of the sandboxed code execution environment into actual \
files and file handles that will be different from what you specify. The \
Python code execution environment has no access to your file system.

Because of this translation layer, DO NOT mention file system paths or \
file references in the prompt outside of the <file> tag.

For example, if you need to include an existing file at "/mnt/text3.md" \
into the prompt, you can reference it as <file src="/mnt/text3.md" />. \
If you do not use <file> tags, the code generator will not be able to \
access the file.

For output, do not ask the code generator to name the files. It will \
assign its own file names to save in the sandbox, and these will be \
picked up at the sandbox boundary and translated into <file> tags for you.
"""


# ---------------------------------------------------------------------------
# Model resolution
# ---------------------------------------------------------------------------


def _resolve_text_model(model: str) -> str:
    """Resolve a model shorthand to a full model name."""
    if model == "pro":
        return PRO_MODEL_NAME
    if model == "flash":
        return FLASH_MODEL_NAME
    if model == "lite":
        return LITE_MODEL_NAME
    return LITE_MODEL_NAME  # default — matches TS fallback


# ---------------------------------------------------------------------------
# generate_text function definition
# ---------------------------------------------------------------------------


def _define_generate_text(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,

    backend: BackendClient | None = None,
) -> FunctionDefinition:
    """Port of the ``generate_text`` function from generate.ts.

    Makes a Gemini sub-call with the user's prompt, optional grounding
    tools, and returns the generated text.
    """

    # TODO: Port full statusUpdater options from TS (expectedDurationInSec,
    # isThought). Currently only the text is forwarded.
    StatusUpdateCallback = Callable[[str | None], None]

    async def handler(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        prompt = args.get("prompt", "")
        model = args.get("model", "flash")
        search_grounding = args.get("search_grounding", False)
        maps_grounding = args.get("maps_grounding", False)
        url_context = args.get("url_context", False)
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        if status_update:
            status_cb(status_update)
        elif search_grounding or maps_grounding:
            status_cb("Researching")
        else:
            status_cb("Generating Text")

        # 1. Resolve pidgin <file> tags in the prompt
        translated = from_pidgin_string(prompt, file_system)
        if isinstance(translated, dict) and "$error" in translated:
            return {"error": translated["$error"]}

        # 2. Build grounding tools
        tools: list[dict[str, Any]] = []
        if search_grounding:
            tools.append({"googleSearch": {}})
        if maps_grounding:
            tools.append({"googleMaps": {}})
        if url_context:
            # TODO: Implement consent flow using suspend/resume machinery
            # (TS uses sink.suspend with ConsentType.GET_ANY_WEBPAGE).
            tools.append({"urlContext": {}})

        # 3. Build the Gemini body
        generation_config: dict[str, Any] = {}
        if model == "pro":
            generation_config["thinkingConfig"] = {
                "includeThoughts": True,
                "thinkingLevel": "high",
            }

        body: dict[str, Any] = {
            "systemInstruction": DEFAULT_SYSTEM_INSTRUCTION,
            "contents": [translated],
            "generationConfig": generation_config,
        }
        if tools:
            body["tools"] = tools

        # 4. Resolve storedData/fileData parts
        try:
            if backend:
                body = await conform_body(
                    body,
                    backend=backend,
                )
        except Exception as e:
            logger.error("generate_text conform_body error: %s", e)
            return {"error": f"Failed to resolve data parts: {e}"}

        # 5. Stream from Gemini
        resolved_model = _resolve_text_model(model)
        result_texts: list[str] = []

        try:
            async for chunk in stream_generate_content(
                resolved_model,
                body,
                backend=backend,
            ):
                candidates = chunk.get("candidates", [])
                if not candidates:
                    continue
                content = candidates[0].get("content", {})
                parts = content.get("parts", [])
                for part in parts:
                    if not part:
                        continue
                    if "text" in part:
                        if part.get("thought"):
                            # TODO: Forward isThought metadata to
                            # status_cb (TS passes { isThought: true }
                            # to statusUpdater).
                            status_cb(part["text"])
                        else:
                            result_texts.append(part["text"])
        except Exception as e:
            logger.error("generate_text streaming error: %s", e)
            return to_error_or_response({"error": str(e)})

        status_cb(None)

        # 6. Merge and return
        if not result_texts:
            return {"error": "No text was generated. Please try again"}
        merged = {"parts": [{"text": "".join(result_texts)}]}
        return {"text": content_to_pidgin_string(merged, file_system)}

    return FunctionDefinition(
        name=GENERATE_TEXT_FUNCTION,
        description=(
            "An extremely versatile text generator, powered by Gemini. "
            "Use it for any tasks that involve generation of text. "
            "Supports multimodal content input."
        ),
        handler=handler,
        icon="text_analysis",
        title="Generating Text",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": (
                        "Detailed prompt to use for text generation. The "
                        "prompt may include references to files. For "
                        'instance, if you have an existing file at '
                        '"/mnt/text3.md", you can reference it as '
                        '<file src="/mnt/text3.md" /> in the prompt. If '
                        "you do not use <file> tags, the text generator "
                        "will not be able to access the file.\n\n"
                        "These references can point to files of any type, "
                        "such as images, audio, videos, etc."
                    ),
                },
                "model": {
                    "type": "string",
                    "enum": ["pro", "flash", "lite"],
                    "description": (
                        "The Gemini model to use for text generation. "
                        "How to choose the right model:\n\n"
                        '- choose "pro" when reasoning over complex '
                        "problems in code, math, and STEM, as well as "
                        "analyzing large datasets, codebases, and "
                        "documents using long context. Use this model "
                        "only when dealing with exceptionally complex "
                        "problems.\n"
                        '- choose "flash" for large scale processing, '
                        "low-latency, high volume tasks that require "
                        "thinking. This is the model you would use most "
                        "of the time.\n"
                        '- choose "lite" for high throughput. Use this '
                        "model when speed is paramount."
                    ),
                },
                "search_grounding": {
                    "type": "boolean",
                    "description": (
                        "Whether or not to use Google Search grounding. "
                        "Grounding with Google Search connects the "
                        "Gemini model to real-time web content and works "
                        "with all available languages. This allows "
                        "Gemini to provide more accurate answers and "
                        "cite verifiable sources beyond its knowledge "
                        "cutoff."
                    ),
                },
                "maps_grounding": {
                    "type": "boolean",
                    "description": (
                        "Whether or not to use Google Maps grounding. "
                        "Grounding with Google Maps connects the "
                        "generative capabilities of Gemini with the "
                        "rich, factual, and up-to-date data of "
                        "Google Maps."
                    ),
                },
                "url_context": {
                    "type": "boolean",
                    "description": (
                        "Set to true to allow Gemini to retrieve "
                        "context from URLs. Useful for tasks like: "
                        "extracting data (pull specific info like "
                        "prices, names, or key findings from multiple "
                        "URLs), comparing documents (analyze multiple "
                        "reports, articles, or PDFs to identify "
                        "differences and track trends), synthesizing "
                        "and creating content (combine information from "
                        "several source URLs to generate accurate "
                        "summaries, blog posts, or reports), and "
                        "analyzing code and docs (point to a GitHub "
                        "repository or technical documentation URL to "
                        "explain code, generate setup instructions, or "
                        "answer questions). Specify URLs in the prompt."
                    ),
                },
                **TASK_ID_SCHEMA,
                **STATUS_UPDATE_SCHEMA,
            },
            "required": ["prompt", "model"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "error": {
                    "type": "string",
                    "description": (
                        "If an error occurred, a description of the error"
                    ),
                },
                "text": {
                    "type": "string",
                    "description": "The output of the text generator.",
                },
            },
        },
    )


# ---------------------------------------------------------------------------
# generate_and_execute_code function definition
# ---------------------------------------------------------------------------

# System instruction for the code generation sub-agent.
_CODE_SYSTEM_INSTRUCTION = {
    "parts": [
        {
            "text": (
                "Your job is to generate and execute code to fulfill "
                "your objective.\n\n"
                "You are working as part of an AI system, so no chit-chat "
                "and no explaining what you're doing and why.\n"
                'DO NOT start with "Okay", or "Alright" or any preambles. '
                "Just the output, please."
            )
        }
    ],
    "role": "user",
}


def _define_generate_and_execute_code(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,

    backend: BackendClient | None = None,
) -> FunctionDefinition:
    """Port of the ``generate_and_execute_code`` function from generate.ts.

    Uses Gemini with codeExecution tool to generate and run Python code,
    returning text results and inline file outputs.
    """

    # TODO: Port full statusUpdater options from TS (expectedDurationInSec,
    # isThought). Currently only the text is forwarded.
    StatusUpdateCallback = Callable[[str | None], None]

    async def handler(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        prompt = args.get("prompt", "")
        search_grounding = args.get("search_grounding", False)
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        if status_update:
            status_cb(status_update)
        elif search_grounding:
            status_cb("Researching")
        else:
            status_cb("Generating Code")

        # 1. Resolve pidgin <file> tags in the prompt
        translated = from_pidgin_string(prompt, file_system)
        if isinstance(translated, dict) and "$error" in translated:
            return {"error": translated["$error"]}

        # 2. Build tools
        tools: list[dict[str, Any]] = []
        if search_grounding:
            tools.append({"googleSearch": {}})
        tools.append({"codeExecution": {}})

        # 3. Build the Gemini body
        body: dict[str, Any] = {
            "systemInstruction": _CODE_SYSTEM_INSTRUCTION,
            "contents": [translated],
        }
        if tools:
            body["tools"] = tools

        # 4. Resolve storedData/fileData parts
        try:
            if backend:
                body = await conform_body(
                    body,
                    backend=backend,
                )
        except Exception as e:
            logger.error("generate_code conform_body error: %s", e)
            return {"error": f"Failed to resolve data parts: {e}"}

        # 5. Stream from Gemini
        result_texts: list[str] = []
        last_code_execution_error: str | None = None

        try:
            async for chunk in stream_generate_content(
                FLASH_MODEL_NAME,
                body,
                backend=backend,
            ):
                candidates = chunk.get("candidates", [])
                if not candidates:
                    continue
                content = candidates[0].get("content", {})
                parts = content.get("parts", [])
                for part in parts:
                    if not part:
                        continue
                    if "text" in part:
                        if part.get("thought"):
                            # TODO: Forward isThought metadata to
                            # status_cb (TS passes { isThought: true }
                            # to statusUpdater).
                            status_cb(part["text"])
                        else:
                            result_texts.append(part["text"])
                    elif "inlineData" in part:
                        # File result from code execution
                        file_path = file_system.add_part(part)
                        if isinstance(file_path, dict) and "$error" in file_path:
                            return {
                                "error": (
                                    "Code generation failed due to "
                                    "invalid file output."
                                )
                            }
                        result_texts.append(f'<file src="{file_path}" />')
                    elif "codeExecutionResult" in part:
                        outcome = part["codeExecutionResult"].get(
                            "outcome", ""
                        )
                        output = part["codeExecutionResult"].get(
                            "output", ""
                        )
                        if outcome != "OUTCOME_OK":
                            last_code_execution_error = output
                        else:
                            last_code_execution_error = None
        except Exception as e:
            logger.error("generate_code streaming error: %s", e)
            return to_error_or_response({"error": str(e)})

        # 6. Check for code execution errors
        if last_code_execution_error:
            return {
                "error": (
                    "The code generator tried and failed with the "
                    f"following error:\n\n{last_code_execution_error}"
                )
            }

        status_cb(None)

        # 7. Merge and return
        if not result_texts:
            return {"error": "No text was generated. Please try again"}
        if len(result_texts) > 1:
            logger.warning("More than one part generated: %s", result_texts)
        merged = "".join(result_texts)
        return {"result": merged}

    return FunctionDefinition(
        name=GENERATE_AND_EXECUTE_CODE_FUNCTION,
        description=(
            "Generates and executes Python code, returning the result "
            "of execution.\n\n"
            "The code is generated by a Gemini model, so a precise spec "
            "is all that's necessary in the prompt: Gemini will generate "
            "the actual code.\n\n"
            "After it's generated, the code is immediately executed in a "
            "sandboxed environment that has access to the following "
            "libraries:\n\n"
            "attrs, chess, contourpy, fpdf, geopandas, imageio, jinja2, "
            "joblib, jsonschema, jsonschema-specifications, lxml, "
            "matplotlib, mpmath, numpy, opencv-python, openpyxl, "
            "packaging, pandas, pillow, protobuf, pylatex, pyparsing, "
            "PyPDF2, python-dateutil, python-docx, python-pptx, "
            "reportlab, scikit-learn, scipy, seaborn, six, striprtf, "
            "sympy, tabulate, tensorflow, toolz, xlrd\n\n"
            "Code execution works best with text and CSV files.\n\n"
            "If the code environment generates an error, the model may "
            "decide to regenerate the code output. This can happen up "
            "to 5 times.\n\n"
            "NOTE: The Python code execution environment has no access "
            "to your file system, so don't use it to access or "
            "manipulate your files."
        ),
        handler=handler,
        icon="code",
        title="Generating and Executing Code",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": (
                        "Detailed prompt for the code to generate. "
                        "DO NOT write Python code as the prompt. Instead "
                        "DO use the natural language. This will let the "
                        "code generator within this tool make the best "
                        "decisions on what code to write. Your job is "
                        "not to write code, but to direct the code "
                        "generator.\n\n"
                        "The prompt may include references to files as "
                        "<file> tags. They will be correctly marshalled "
                        "across the sandbox boundary."
                    ),
                },
                "search_grounding": {
                    "type": "boolean",
                    "description": (
                        "Whether or not to use Google Search grounding. "
                        "Grounding with Google Search connects the code "
                        "generation model to real-time web content and "
                        "works with all available languages. This allows "
                        "Gemini to power more complex use cases."
                    ),
                },
                **TASK_ID_SCHEMA,
                **STATUS_UPDATE_SCHEMA,
            },
            "required": ["prompt"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "error": {
                    "type": "string",
                    "description": (
                        "If an error occurred, a description of the error"
                    ),
                },
                "result": {
                    "type": "string",
                    "description": (
                        "The result of code execution as text that may "
                        "contain file path references."
                    ),
                },
            },
        },
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_generate_function_group(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,

    backend: BackendClient | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with the generate_text function.

    This is the Python equivalent of ``getGenerateFunctionGroup`` from
    generate.ts.

    Args:
        file_system: The AgentFileSystem for resolving file references.
        task_tree_manager: Optional TaskTreeManager for progress tracking.

        backend: BackendClient for One Platform upload calls.

    Returns:
        A FunctionGroup with the generate_text declaration, definition,
        and instruction.
    """
    functions: list[FunctionDefinition] = [
        _define_generate_text(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            backend=backend,
        ),
        _define_generate_and_execute_code(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            backend=backend,
        ),
    ]

    mapped = map_definitions(functions)
    return FunctionGroup(
        definitions=mapped.definitions,
        declarations=mapped.declarations,
        instruction=_INSTRUCTION,
    )
