# Agent UX Information Catalog

This document catalogs all the distinct pieces of information that the Agent
system can expose to users. It focuses on **what** information is available, not
**how** it should be presented.

---

## 1. Execution Lifecycle Information

### 1.1 Run Status

- **Current status**: `"running"` | `"failed"` | `"completed"`
- **Is resuming**: Whether this run is resuming from a previous failed attempt
- **Resumable**: Whether the current run can be resumed later (disabled if graph
  is edited)

### 1.2 Timing

- **Start time**: Absolute timestamp when the run began
- **End time**: Absolute timestamp when the run finished (if applicable)
- **Elapsed time**: Real-time updating duration since run started

### 1.3 Initial Message

- **Initial message phrase**: The message shown to the user when the request is
  sent but no response has been received yet (e.g., "Brainstorming first step",
  "Analyzing objective")

---

## 2. Objective & Context Information

### 2.1 The Objective

- **Original objective content**: The user's initial request/goal (as
  `LLMContent`)
- **Translated objective**: The processed version with file references resolved

### 2.2 Feature Flags

- **Use Memory**: Whether the memory tools are enabled for this run

---

## 3. Thinking & Reasoning Information

- **Thought title**: A short phrase extracted from thought content (the first
  bolded line, e.g., "**Generating layouts**" → "Generating layouts")
- **Thought text**: The full thinking content from the model

---

## 4. Function Calling Information

Functions can be associated with tasks via **task IDs**, allowing the UI to show
which task a function is working toward.

### 4.1 Function Call Entry

- **Function name**: The name of the function being called
- **Function arguments**: The parameters passed to the function
- **Task ID**: Optional link to the task tree (format `"task_NNN"`)

### 4.2 Function Execution Status

- **Status text**: Current activity description (e.g., "Searching the web",
  "Generating image")
- **Expected duration**: Estimated time for this specific function
- **Progress completion**: Numeric 0-1 value for determinate progress

### 4.3 Function Thoughts

- **Thought stream**: A function may emit its own stream of thoughts during
  execution

### 4.4 Function Result

- **Result content**: The output from the function (as `LLMContent`)
- **Error information**: If the function failed, the error message and optional
  metadata

### 4.5 Function Links

- **URI**: Target location
- **Title**: Display text
- **Icon URI**: Visual indicator

### 4.6 Chat Function Responses

Chat messages and choices are function responses that require special rendering:

**Chat Messages**

- **Role**: Who said it (`"user"` | `"model"`)
- **Content**: Rich `LLMContent` with text, images, files

**Choice Interactions**

- **Message/prompt**: The question or context for the choices
- **Choice options**: Array of `{id, label}` pairs
- **Selection mode**: Single or multiple selection allowed
- **Layout hint**: Preferred arrangement (`"list"` | `"row"` | `"grid"`)
- **"None of the above" option**: Optional escape hatch label
- **Selected choices**: The user's selection(s)

---

## 5. Task Tree Information

Hierarchical breakdown of the agent's work plan. Functions reference task IDs to
show what task they're contributing to.

### 5.1 Task Node

- **Task ID**: Unique identifier (format: `"task_NNN"`)
- **Description**: Detailed explanation of what the task entails
- **Execution mode**: How subtasks should run (`"serial"` | `"concurrent"`)
- **Status**: Current state (`"not_started"` | `"in_progress"` | `"complete"`)
- **Subtasks**: Nested child tasks

### 5.2 Task Progress

- **Progress message**: Current activity for an in-progress task
- **Task completion**: Which tasks have been marked complete

---

## 6. File System & Memory Information

### 6.1 File Entry

- **File path**: The virtual path (e.g., `/mnt/images/logo.png`)
- **MIME type**: Content type of the file
- **Data**: The actual content (text, base64, or reference)
- **Type**: Storage type (`"text"` | `"storedData"` | `"inlineData"` |
  `"fileData"`)
- **Title**: Optional human-readable title

### 6.2 System Files

- **Chat log**: Accumulated conversation history (`/mnt/chat_log.json`)
- **Task tree**: Current task breakdown (`/mnt/task_tree`)

### 6.3 Memory / Sheets

- **Sheet name**: Identifier
- **Columns**: Schema definition
- **File path**: Where the sheet is stored
- **Range**: Cell range (e.g., `"A1:C10"`)
- **Values**: 2D array of cell contents

---

## 7. Errors & Final Outcome

- **Success**: Boolean indicating completion
- **Objective outcome**: Text description of what was achieved
- **Next step URL**: If routing to another agent (`href`)
- **Intermediate files**: Files created during execution (path + content pairs)

---

## 8. Low-Level Debugging Information

For troubleshooting and development:

- **Model name**: Which model is being used (e.g., "gemini-3-flash-preview")
- **Request body**: The full payload sent to the model
- **Conversation contents**: The full multi-turn conversation history

---

## Open Questions for UX Design

1. **Thought visibility**: Show all thoughts? Summarized? Hidden by default?
2. **File system browsing**: Allow exploration of agent's virtual file system?
3. **Run history**: Show previous run attempts and their status?
4. **Error recovery**: How to present resumability and partial progress?
5. **Task-function relationship**: How prominently to show which task a function
   belongs to?
