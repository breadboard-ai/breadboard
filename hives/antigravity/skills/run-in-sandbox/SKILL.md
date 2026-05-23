---
name: run-in-sandbox
title: How to run in sandbox
description:
  Teaches you how to properly operate in the sandboxed environment you're in.
allowed-tools:
  - sandbox.*
---

# The sandbox

When you call `execute_bash` function, it runs in a sandboxed environment. You
have acess to most bash commands. The `PATH` is configured to give you access to
`node` and `python3`.

Even though you can use heredoc to write and `cat` to read files, prefer the
built-in file functions, if they available.
