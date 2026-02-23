# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
System functions for the agent loop.

Port of ``functions/system.ts``. This module provides all system functions:
termination (``system_objective_fulfilled`` / ``system_failed_to_fulfill_objective``),
file operations (``system_list_files``, ``system_write_file``,
``system_read_text_from_file``), and task tree management
(``system_create_task_tree``, ``system_mark_completed_tasks``).
"""

from __future__ import annotations

from datetime import datetime
import inspect
from typing import Any, Callable, Awaitable

from ..function_definition import (
    FunctionDefinition,
    FunctionGroup,
    map_definitions,
)
from ..loop import AgentResult, FileData, LoopController
from ..agent_file_system import AgentFileSystem
from ..task_tree_manager import TaskTreeManager, TASK_TREE_SCHEMA
from ..pidgin import from_pidgin_string

# Function name constants (must match the TypeScript originals exactly).
OBJECTIVE_FULFILLED_FUNCTION = "system_objective_fulfilled"
FAILED_TO_FULFILL_FUNCTION = "system_failed_to_fulfill_objective"
LIST_FILES_FUNCTION = "system_list_files"
WRITE_FILE_FUNCTION = "system_write_file"
READ_TEXT_FROM_FILE_FUNCTION = "system_read_text_from_file"
CREATE_TASK_TREE_FUNCTION = "system_create_task_tree"
MARK_COMPLETED_TASKS_FUNCTION = "system_mark_completed_tasks"
OBJECTIVE_OUTCOME_PARAMETER = "objective_outcome"
TASK_ID_PARAMETER = "task_id"


def _build_instruction() -> str:
    """Build the system instruction with the current date interpolated.

    This is the full meta-plan prompt from system.ts, reproduced verbatim
    (with Python f-string interpolation for dynamic values).
    """
    now = datetime.now().strftime("%B %-d, %Y %-I:%M %p")

    return f"""
You are an LLM-powered AI agent, orchestrated within an application alongside other AI agents. During this session, your job is to fulfill the objective, specified at the start of the conversation context. The objective provided by the application and is not visible to the user of the application. Similarly, the outcome you produce is delivered by the orchestration system to another agent. The outcome is also not visible to the user to the application.

You may receive input from other agents (their outcomes) in the form of <input source-agent="agent_name">content</input> tags. The content of the tag is the input from the agent.

You are also linked with other AI agents via hyperlinks. The <a href="url">title</a> syntax points at another agent. If the objective calls for it, you can transfer control to this agent. To transfer control, use the url of the agent in the  "href" parameter when calling "{OBJECTIVE_FULFILLED_FUNCTION}" or "{FAILED_TO_FULFILL_FUNCTION}" function. As a result, the outcome will be transferred to that agent.

To help you orient in time, today is {now}

In your pursuit of fulfilling the objective, follow this meta-plan PRECISELY.

<meta-plan>

## STEP 1. Evaluate If The Objective Can Be Fulfilled

Ask yourself: can the objective be fulfilled with the tools and capabilities you have? Is there missing data? Can it be requested from the user? Do not make any assumptions.

If the required tools or capabilities are missing available to fulfill the objective, call "{FAILED_TO_FULFILL_FUNCTION}" function. Do not overthink it. It's better to exit quickly than waste time trying and fail at the end.

### Content Policy Guardrails

The generation tools you have access to enforce content policies. Requests that violate these policies will fail, wasting time and resources. You MUST proactively refuse such requests by calling "{FAILED_TO_FULFILL_FUNCTION}" BEFORE attempting any generation.

Refuse the objective and call "{FAILED_TO_FULFILL_FUNCTION}" if it asks you to generate content that falls into any of these categories:

- **Minors**: generating images, videos, or other media depicting minors (children) is not supported.
- **Prominent people**: generating images, videos, or other media depicting real-world prominent people (celebrities, politicians, public figures, etc.) is not supported.
- **Violence**: generating violent content is against content policies.
- **Harmful content**: generating dangerous or hateful content is against content policies.
- **Sexual content**: generating sexual content is against content policies.
- **Recitation**: generating content that closely reproduces existing copyrighted material will be blocked.

When refusing, provide a friendly explanation in the "user_message" parameter of the "{FAILED_TO_FULFILL_FUNCTION}" function that clearly states WHY the request cannot be fulfilled and suggests alternative approaches the user might try.

## STEP 2. Determine Problem Domain and Overall Approach

Applying the Cynefin framework, determine the domain of the problem into which fulfilling the objective falls. Most of the time, it will be one of these:

1) Simple -- the objective falls into the domain of simple problems: it's a simple task. 

2) Complicated - the objective falls into the domain of complicated problems: fulfilling the object requires expertise, careful planning and preparation.

3) Complex - the objective is from the complex domain. Usually, any objective that involves interpreting free text entry from the user or unreliable tool outputs fall into this domain: the user may or may not follow the instructions provided to them, which means that any plan will continue evolving.

NOTE: depending on what functions you're provided with, you may not have the means to interact with the user. In such cases, it is unlikely you'll encounter the problem from complex domain.

Ask yourself: what is the problem domain? Is it simple, complicated, or complex? If not sure, start with complicated and see if it works.

## STEP 3. Proceed with Fulfilling Objective.

For simple tasks, take the "just do it" approach. No planning necessary, just perform the task. Do not overthink it and emphasize expedience over perfection.

For complicated tasks, create a detailed task tree and spend a bit of time thinking through the plan prior to engaging with the problem.

When dealing with complex problems, adopt the OODA loop approach: instead of devising a detailed plan, focus on observing what is happening, orienting toward the objective, deciding on the right next step, and acting.

### Creating and Using a Task Tree

When working on a complicated problem, use the "{CREATE_TASK_TREE_FUNCTION}" function create a dependency tree for the tasks. Every task must loosely correspond to a function being called.

Take the following approach:

First, consider which tasks can be executed concurrently and which ones must be executed serially?

When faced with the choice of serial or concurrent execution, choose concurrency to save precious time.

Now, start executing the plan. 

For concurrent tasks, make sure to generate multiple function calls simultaneously. 

To better match function calls to tasks, use the "{TASK_ID_PARAMETER}" parameter in the function calls. To express more granularity within a task, add extra identifiers at the end like this: "task_001_1". This means "task_001, part 1".

After each task is completed, examine: is the plan still good? Did the results of the tasks affect the outcome? If not, keep going. Otherwise, reexamine the plan and adjust it accordingly.

Use the "{MARK_COMPLETED_TASKS_FUNCTION}" function to keep track of the completed tasks. All tasks are automatically marked as completed when the "{OBJECTIVE_FULFILLED_FUNCTION}" is called, so avoid the unnecessary "{MARK_COMPLETED_TASKS_FUNCTION}" function calls at the end. 

### Problem Domain Escalation

While fulfilling the task, it may become apparent to you that your initial guess of the problem domain is wrong. Most commonly, this will cause the problem domain escalation: simple problems turn out complicated, and complicated become complex. Be deliberate about recognizing this change. When it happens, remind yourself about the problem domain escalation and adjust the strategy appropriately.

## STEP 4. Return the objective outcome

Only after you've completely fulfilled the objective call the "{OBJECTIVE_FULFILLED_FUNCTION}" function. This is important. This function call signals the end of work and once called, no more work will be done. Pass the outcome of your work as the "{OBJECTIVE_OUTCOME_PARAMETER}" parameter.

### What to return

Return outcome as a text content that can reference files. They will be included as part of the outcome. For example, if you need to return multiple existing images or videos, just reference them using <file> tags in the "{OBJECTIVE_OUTCOME_PARAMETER}" parameter.

Only return what is asked for in the objective. DO NOT return any extraneous commentary, labels, or intermediate outcomes. The outcome is delivered to another agent and the extraneous chit-chat or additional information, while it may seem valuable, will only confuse the next agent.

### How to determine what to return

1. Examine the objective and see if there is an instruction with the verb "return". If so, the outcome must be whatever is specified in the instruction.

Example: "evaluate multiple products for product market fit and return the verdict on which fits the best" -- the outcome is the verdict only.

2. If there's not "return" instruction, identify the key artifact of the objective and return that.

Example 1: "research the provided topic and generate an image of ..." -- return just a file reference to the image without any extraneous text.

Example 2: "Make a blog post writer. It ... shows the header graphic and the blog post as a final result" -- return just the header graphic as a file reference and a blog post.

3. If the objective is not calling for any outcome to be returned, it is perfectly fine to return an empty string as outcome. The mere fact of calling the "{OBJECTIVE_FULFILLED_FUNCTION}" function is an outcome in itself.

Example 2: "Examine the state and if it's empty, go to ... otherwise, go to ..." -- return an empty string.

IMPORTANT: DO NOT start the "{OBJECTIVE_OUTCOME_PARAMETER}" parameter value with a "Here is ..." or "Okay", or "Alright" or any preambles. You are working as part of an AI system, so no chit-chat and no explaining what you're doing and why. Just the output, please. 

In situations when you failed to fulfill the objective, invoke the "{FAILED_TO_FULFILL_FUNCTION}" function.


</meta-plan>

## Using Files

The system you're working in has a virtual file system. The file paths you have access to are always prefixed with the "/mnt/". Every file path will be of the form "/mnt/[name]". Use snake_case to name files.

You can use the <file src="/mnt/path" /> syntax to embed them in text.

Only reference files that you know to exist. If you aren't sure, call the "{LIST_FILES_FUNCTION}" function to confirm their existence. Do NOT make hypothetical file tags: they will cause processing errors.

NOTE: The post-processing parser that reads your generated output and replaces the <file src="/mnt/path" /> with the contents of the file. Make sure that your output still makes sense after the replacement.

### Good example

Evaluate the proposal below according to the provided rubric:

Proposal:

<file src="/mnt/proposal.md" />

Rubric:

<file src="/mnt/rubric.md" />

### Bad example 

Evaluate proposal <file src="/mnt/proposal.md" /> according to the rubric <file src="/mnt/rubric.md" />

In the good example above, the replaced texts fit neatly under each heading. In the bad example, the replaced text is stuffed into the sentence.
"""


# ---- System function definitions ----


def _define_objective_fulfilled(
    controller: LoopController,
    file_system: AgentFileSystem | None = None,
    success_callback: Callable[[str, str], Any] | None = None,
) -> FunctionDefinition:
    """Port of ``system_objective_fulfilled`` from system.ts."""

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        href = args.get("href", "/")
        outcome_text = args.get("objective_outcome", "")

        # If a success callback is provided (e.g. for pidgin translation),
        # run it first. The TS version awaits this callback.
        if success_callback:
            result = success_callback(href, outcome_text)
            # Await if the callback is async (matches TS Promise<Outcome<void>>)
            if inspect.isawaitable(result):
                result = await result
            if isinstance(result, dict) and "$error" in result:
                return {"error": result["$error"]}

        # Resolve pidgin <file> tags in the outcome text to LLMContent.
        # Port of the translator.fromPidginString() call in loop-setup.ts.
        outcomes: dict[str, Any]
        intermediate: list[dict[str, Any]] | None = None

        if file_system and outcome_text:
            resolved = from_pidgin_string(outcome_text, file_system)
            if isinstance(resolved, dict) and "$error" in resolved:
                return {"error": resolved["$error"]}
            outcomes = resolved

            # Collect all intermediate files with their resolved parts.
            # Port of the intermediate file collection in loop-setup.ts.
            intermediate: list[FileData] = []
            for path in list(file_system.files.keys()):
                file_parts = file_system.get(path)
                if isinstance(file_parts, dict) and "$error" in file_parts:
                    continue
                # file_parts is a list of data parts; take the first one
                if file_parts:
                    intermediate.append(
                        FileData(path=path, content=file_parts[0])
                    )
        else:
            outcomes = {"parts": [{"text": outcome_text}]}

        result_data = AgentResult(
            success=True,
            href=href,
            outcomes=outcomes,
        )
        if intermediate is not None:
            result_data.intermediate = intermediate
        controller.terminate(result_data)
        return {}

    return FunctionDefinition(
        name=OBJECTIVE_FULFILLED_FUNCTION,
        description=(
            "Inidicates completion of the overall objective. "
            "Call only when the specified objective is entirely fulfilled"
        ),
        handler=handler,
        icon="check_circle",
        title="Returning final outcome",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "objective_outcome": {
                    "type": "string",
                    "description": (
                        'Your return value: the content of the fulfilled '
                        'objective. The content may include references to '
                        'files. For instance, if you have an existing file '
                        'at "/mnt/image4.png", you can reference it as '
                        '<file src="/mnt/image4.png" /> in content. If you '
                        'do not use <file> tags, the contents of this file '
                        'will not be included as part of the outcome.\n\n'
                        'These references can point to files of any type, '
                        'such as text, audio, videos, etc. Projects can '
                        'also be referenced in this way.\n\n'
                        'You are working as part of an AI system, so don\'t '
                        'add chit-chat or meta-monologue, and don\'t explain '
                        'what you did or why. Just the outcome, please.'
                    ),
                },
                "href": {
                    "type": "string",
                    "description": (
                        'The url of the next agent to which to transfer '
                        'control upon completion. By default, the control '
                        'is transferred to the root agent "/". If the '
                        'objective specifies other agent URLs using the '
                        '<a href="url">title</a> syntax, and calls to '
                        'choose a different agent to which to transfer '
                        'control, then that url should be used instead.'
                    ),
                    "default": "/",
                },
            },
            "required": ["objective_outcome"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "error": {
                    "type": "string",
                    "description": (
                        "A detailed error message that usually indicates "
                        "invalid parameters being passed into the function"
                    ),
                },
            },
        },
    )


def _define_failed_to_fulfill(
    controller: LoopController,
    failure_callback: Callable[[str], None] | None = None,
) -> FunctionDefinition:
    """Port of ``system_failed_to_fulfill_objective`` from system.ts."""

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        user_message = args.get("user_message", "")

        if failure_callback:
            failure_callback(user_message)

        controller.terminate(
            AgentResult(
                success=False,
                outcomes={"parts": [{"text": user_message}]},
            )
        )
        return {}

    return FunctionDefinition(
        name=FAILED_TO_FULFILL_FUNCTION,
        description=(
            "Inidicates that the agent failed to fulfill of the overall "
            "objective. Call ONLY when all means of fulfilling the objective "
            "have been exhausted."
        ),
        handler=handler,
        icon="cancel",
        title="Unable to proceed",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "user_message": {
                    "type": "string",
                    "description": (
                        "Text to display to the user upon admitting failure "
                        "to fulfill the objective. Provide a friendly "
                        "explanation of why the objective is impossible to "
                        "fulfill and offer helpful suggestions, but don't "
                        "end with a question, since that would leave the "
                        "user hanging: you've failed and can't answer that "
                        "question"
                    ),
                },
                "href": {
                    "type": "string",
                    "description": (
                        'The url of the next agent to which to transfer '
                        'control upon failure. By default, the control is '
                        'transferred to the root agent "/". If the '
                        'objective specifies other agent URLs using the '
                        '<a href="url">title</a> syntax, and calls to '
                        'choose a different agent to which to transfer '
                        'control, then that url should be used instead.'
                    ),
                    "default": "/",
                },
            },
            "required": ["user_message"],
        },
    )


# ---- File system functions ----


def _define_list_files(
    file_system: AgentFileSystem,
) -> FunctionDefinition:
    """Port of ``system_list_files`` from system.ts."""

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        status_update = args.get("status_update")
        if status_cb and status_update:
            status_cb(status_update)
        elif status_cb:
            status_cb("Getting a list of files")
        return {"list": file_system.list_files()}

    return FunctionDefinition(
        name=LIST_FILES_FUNCTION,
        description="Lists all files",
        handler=handler,
        icon="folder",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "status_update": {
                    "type": "string",
                    "description": (
                        "A short, user-facing status update that will be "
                        "displayed in the UI while this function executes."
                    ),
                },
            },
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "list": {
                    "type": "string",
                    "description": "List of all files as file paths",
                },
            },
        },
    )


def _define_write_file(
    file_system: AgentFileSystem,
) -> FunctionDefinition:
    """Port of ``system_write_file`` from system.ts."""

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        file_name = args.get("file_name", "")
        content = args.get("content", "")

        # Resolve <file> tags in the content via pidgin translator
        translated = from_pidgin_string(content, file_system)
        if isinstance(translated, dict) and "$error" in translated:
            return {"error": translated["$error"]}

        # Extract text from the translated content parts
        text_parts = []
        for part in translated.get("parts", []):
            if "text" in part:
                text_parts.append(part["text"])
        resolved_content = "\n".join(text_parts) if text_parts else content

        file_path = file_system.write(file_name, resolved_content)
        return {"file_path": file_path}

    return FunctionDefinition(
        name=WRITE_FILE_FUNCTION,
        description="Writes the provided text to a file",
        handler=handler,
        icon="edit",
        title="Writing to file",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "file_name": {
                    "type": "string",
                    "description": (
                        'The name of the file with the extension. '
                        'This is the name that will come after the "/mnt/" '
                        'prefix in the file path. Use snake_case for naming. '
                        'If the file does not exist, it will be created. '
                        'If the file already exists, its content will be '
                        'overwritten. '
                        'Examples: "report.md", "data.csv", "notes.txt", '
                        '"config.json", "index.html"'
                    ),
                },
                "content": {
                    "type": "string",
                    "description": "The content to write into a file",
                },
            },
            "required": ["file_name", "content"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": (
                        "The path to the file containing the provided text"
                    ),
                },
                "error": {
                    "type": "string",
                    "description": (
                        "The error message if the file could not be written"
                    ),
                },
            },
        },
    )


def _define_read_text_from_file(
    file_system: AgentFileSystem,
) -> FunctionDefinition:
    """Port of ``system_read_text_from_file`` from system.ts."""

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        file_path = args.get("file_path", "")
        text = file_system.read_text(file_path)
        if isinstance(text, dict) and "$error" in text:
            return {"error": text["$error"]}
        return {"text": text}

    return FunctionDefinition(
        name=READ_TEXT_FROM_FILE_FUNCTION,
        description=(
            "Reads text from a file and return text as string. If the file "
            "does not contain text or is not supported, an error will be "
            "returned."
        ),
        handler=handler,
        icon="description",
        title="Reading from file",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": (
                        "The file path of the file to read the text from."
                    ),
                },
            },
            "required": ["file_path"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": (
                        "The text contents of a file as a string."
                    ),
                },
                "error": {
                    "type": "string",
                    "description": (
                        "If an error has occurred, will contain a "
                        "description of the error"
                    ),
                },
            },
        },
    )


# ---- Task tree functions ----


def _define_create_task_tree(
    task_tree_manager: TaskTreeManager,
) -> FunctionDefinition:
    """Port of ``system_create_task_tree`` from system.ts."""

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        task_tree = args.get("task_tree")
        if not task_tree:
            return {"error": "task_tree is required"}
        file_path = task_tree_manager.set(task_tree)
        return {"file_path": file_path}

    return FunctionDefinition(
        name=CREATE_TASK_TREE_FUNCTION,
        description=(
            "When working on a complicated problem, use this function to "
            "create a scratch pad to reason about a dependency tree of "
            "tasks, like about the order of tasks, and which tasks can be "
            "executed concurrently and which ones must be executed serially."
        ),
        handler=handler,
        icon="task",
        title="Creating task tree",
        parameters_json_schema=TASK_TREE_SCHEMA,
        response_json_schema={
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                },
            },
        },
    )


def _define_mark_completed_tasks(
    task_tree_manager: TaskTreeManager,
) -> FunctionDefinition:
    """Port of ``system_mark_completed_tasks`` from system.ts."""

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        task_ids = args.get("task_ids", [])
        file_path = task_tree_manager.set_complete(task_ids)
        return {"file_path": file_path}

    return FunctionDefinition(
        name=MARK_COMPLETED_TASKS_FUNCTION,
        description=(
            f'Mark one or more tasks defined with the '
            f'"{CREATE_TASK_TREE_FUNCTION}" as complete.'
        ),
        handler=handler,
        icon="task",
        title="Marking tasks complete",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "task_ids": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "description": (
                            'The "task_id" from the task tree to mark as '
                            'completed'
                        ),
                    },
                    "description": (
                        "The list of tasks to mark as completed"
                    ),
                },
            },
            "required": ["task_ids"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": (
                        "The file path to the updated task tree"
                    ),
                },
            },
        },
    )


# ---- Public API ----


def get_system_function_group(
    controller: LoopController,
    *,
    file_system: AgentFileSystem | None = None,
    task_tree_manager: TaskTreeManager | None = None,
    success_callback: Callable[[str, str], Any] | None = None,
    failure_callback: Callable[[str], None] | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with all system functions.

    This is the Python equivalent of ``getSystemFunctionGroup`` from
    system.ts. It wires termination, file, and task tree functions.

    Args:
        controller: The LoopController for termination functions.
        file_system: The AgentFileSystem for file operations. When
            ``None``, file functions are omitted.
        task_tree_manager: The TaskTreeManager for task tree operations.
            When ``None``, task tree functions are omitted.
        success_callback: Optional callback for objective_fulfilled.
        failure_callback: Optional callback for failed_to_fulfill.

    Returns:
        A FunctionGroup with declarations, definitions, and instruction.
    """
    functions: list[FunctionDefinition] = [
        _define_objective_fulfilled(controller, file_system, success_callback),
        _define_failed_to_fulfill(controller, failure_callback),
    ]

    if file_system is not None:
        functions.extend([
            _define_list_files(file_system),
            _define_write_file(file_system),
            _define_read_text_from_file(file_system),
        ])

    if task_tree_manager is not None:
        functions.extend([
            _define_create_task_tree(task_tree_manager),
            _define_mark_completed_tasks(task_tree_manager),
        ])

    mapped = map_definitions(functions)
    return FunctionGroup(
        definitions=mapped.definitions,
        declarations=mapped.declarations,
        instruction=_build_instruction(),
    )
