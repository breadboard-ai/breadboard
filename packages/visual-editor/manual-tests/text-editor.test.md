# Text Editor (`bb-text-editor`) — Manual Test Plan

The text editor is a `contenteditable` prompt editor that supports inline chips
for referencing assets, tools, steps, and routes. It uses the Fast Access Menu
(`@` menu) to insert and edit these chips.

## Prerequisites

- A board with at least **two connected steps** (so routing destinations exist)
- At least one **asset** uploaded to the board
- Agent mode enabled on at least one step (for agent mode tools)

---

## 1. Basic Text Editing

### 1.1 Type and Edit Text

1. Click into the text editor of a step
2. Type some prompt text
3. Use arrow keys, backspace, delete to edit
4. **Expected**: Text appears and edits normally

### 1.2 Placeholder

1. Clear all text from the editor
2. **Expected**: Placeholder text "Type your prompt here. Use @ to include other
   content." appears
3. Start typing
4. **Expected**: Placeholder disappears immediately

### 1.3 Paste

1. Copy rich HTML content from a webpage
2. Paste into the editor
3. **Expected**: Only plain text is pasted (HTML is sanitized)

### 1.4 Save with Ctrl+Enter

1. Type some text in the editor
2. Press `Ctrl+Enter` (or `Cmd+Enter` on Mac)
3. **Expected**: Step configuration is saved

---

## 2. Fast Access Menu (`@`)

### 2.1 Open Menu

1. Type `@` in the editor
2. **Expected**: Fast access menu appears at cursor position
3. **Expected**: Menu shows sections: Assets, Tools, Steps

### 2.2 Filter Items

1. Open the `@` menu
2. Type a filter string
3. **Expected**: Items are filtered by the typed text

### 2.3 Keyboard Navigation

1. Open the `@` menu
2. Use `↑`/`↓` arrow keys
3. **Expected**: Selection highlight moves through items
4. Press `Enter`
5. **Expected**: Selected item is inserted as a chip

### 2.4 Dismiss

1. Open the `@` menu
2. Press `Escape`
3. **Expected**: Menu closes, no chip inserted, `@` character remains
4. Open the `@` menu again
5. Click outside the menu
6. **Expected**: Menu closes

---

## 3. Chip Insertion

### 3.1 Insert Asset

1. Open `@` menu
2. Select an asset
3. **Expected**: Asset chip appears with icon and title
4. **Expected**: Editor value captures the template part

### 3.2 Insert Step Reference

1. Open `@` menu
2. Select a step from "Steps" section
3. **Expected**: Step chip appears with the step's icon and title

### 3.3 Insert Tool (Agent Mode)

1. On a step with agent mode enabled, open `@` menu
2. Select a tool from "Agent Mode Tools" (e.g., "Go to", "Use Memory")
3. **Expected**: Tool chip appears with appropriate icon

---

## 4. Routing Chip ("Go to")

### 4.1 Add Route with Destination

1. On a step with outgoing connections, open `@` menu
2. Select "Go to" from Agent Mode Tools
3. **Expected**: A routing chip appears and immediately opens a sub-menu showing
   connected steps
4. Select a destination step (e.g., "Generate 2")
5. **Expected**: Routing chip shows "→ Go to [icon] Generate 2 ▾"

### 4.2 Destination Persists After Deselection (Regression Test)

1. Add a "Go to" chip with a destination (per 4.1)
2. Click away from the step to deselect it
3. Click back on the step to re-open the editor
4. **Expected**: Routing chip still shows "→ Go to [icon] Generate 2 ▾"
5. **Expected**: The destination name and icon are visible, not empty

> **Background**: The `value` setter fires before the SCA context resolves on
> re-render. A `#needsChicletRefresh` flag ensures chips are re-rendered once
> SCA arrives.

### 4.3 Change Route Destination

1. Click on an existing routing chip (with a destination)
2. **Expected**: Sub-menu opens showing only connected steps ("Routes" mode)
3. Select a different destination step
4. **Expected**: Routing chip updates to show the new destination
5. Click away and back
6. **Expected**: New destination persists

### 4.4 No Routes Available

1. On a step with **no** outgoing connections, add a "Go to" chip
2. **Expected**: Sub-menu shows "No routes" message

---

## 5. Memory Chip ("Use Memory")

### 5.1 Add Memory Chip

1. On a step with agent mode, open `@` menu
2. Select "Use Memory"
3. **Expected**: Memory chip appears with database icon and "Use Memory" label

---

## 6. Chip Selection and Editing

### 6.1 Select a Chip

1. Click on a chip
2. **Expected**: Chip gets a "selected" visual state (highlight)

### 6.2 Delete a Chip with Backspace

1. Place cursor immediately after a chip
2. Press `Backspace`
3. **Expected**: Chip is removed

### 6.3 Delete a Chip with Delete Key

1. Select a chip by clicking it
2. Press `Delete`
3. **Expected**: Chip is removed

### 6.4 Arrow Key Navigation Around Chips

1. Place cursor in text before a chip
2. Press `→` to move past the chip
3. **Expected**: Cursor jumps over the chip (and its zero-width space buffer)
4. Press `←`
5. **Expected**: Cursor jumps back over the chip

---

## 7. Multiple Chips

### 7.1 Multiple Chips in One Editor

1. Add a text, then an asset chip, then more text, then a step chip
2. **Expected**: All chips render correctly inline with text
3. **Expected**: Text between chips is editable

### 7.2 Adjacent Chips

1. Add two chips back-to-back (no text between)
2. **Expected**: A zero-width space separator exists between them
3. **Expected**: Arrow keys navigate correctly between them

---

## 8. Read-Only Mode

### 8.1 Read-Only Prevents Editing

1. Open a step editor in a context where `readOnly` is true
2. **Expected**: Text is not editable
3. **Expected**: `@` key does not open the fast access menu
4. **Expected**: Chips are visible but not interactive

---

## 9. Copy/Cut

### 9.1 Copy Selection

1. Select a range of text (may include chips)
2. Press `Ctrl+C` / `Cmd+C`
3. Paste into an external text editor
4. **Expected**: Plain text representation (with zero-width spaces stripped)

### 9.2 Cut Selection

1. Select a range including a chip
2. Press `Ctrl+X` / `Cmd+X`
3. **Expected**: Selected content is removed from the editor
4. **Expected**: Clipboard contains the cut text
