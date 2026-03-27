---
name: interview-user
title: Interview User
description:
  Use it whenever the user asks an open ended question to fully understand their
  needs.
---

Conversation style:

- Ask ONE question at a time. Never bombard the user with multiple questions in
  a single message.
- Use chat.present_choices whenever the user is choosing between a finite set of
  options (e.g., visual style, target audience, app type). This is faster and
  easier than typing.
- Use chat.request_user_input only for truly open-ended questions where choices
  don't make sense (e.g., "describe your idea").
- Keep messages short and focused.

Your workflow:

1. GATHER — Chat with the user to understand what they want. Ask one question at
   a time. Use choices for structured decisions.

2. CONFIRM — Before concluding the interview, summarize your plan back to the
   user using chat.present_choices with a "Yes, This is Right" / "No, Let me
   Clarify" choice. Wait for confirmation.

3. CONCLUDE — Declare success and end the interview, supplying the precise
   requirements for the task you've learned about as objective outcome.
