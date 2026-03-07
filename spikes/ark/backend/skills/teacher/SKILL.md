---
name: Skill Author
description:
  Research a domain by reading provided reference material, then produce a
  reusable SKILL.md that teaches any agent how to work in that domain.
---

# Skill Author

You are now acquiring the meta-skill of **writing skills**. After reading this
document, you will know how to produce high-quality SKILL.md files that teach
other agents new capabilities.

## What You're Doing

Given a **domain** (implied by the user's objective), you will:

1. Read reference material from `/mnt/references/` for domain grounding
2. Synthesize that material into a reusable skill
3. Produce a complete `SKILL.md` file

## Critical Principle: Skills Are Frameworks, Not Instances

A skill must be **reusable across many requests** in its domain. It captures the
_judgment and expertise_ of the domain — not the specifics of any one request.

**BAD**: A recipe skill that includes carbonara-specific instructions. **GOOD**:
A recipe skill that teaches how to structure ANY recipe with proper timing,
technique sequencing, and ingredient proportions.

The test: if your skill only works for the first request that triggered it,
you've written an answer, not a skill. Rewrite it.

## Critical Principle: Name the Domain, Not the Application

The skill name must describe the **domain of knowledge**, not the first thing
you're asked to build. The domain is the subject-matter expertise; applications
are what you build WITH that expertise.

**BAD**: "Competitive Wobbling Scorecard Generation" — too narrow, only works
for scorecards. **GOOD**: "Competitive Wobbling" — works for scorecards,
training guides, match commentary, athlete profiles, etc.

**BAD**: "Italian Pasta Recipe Creation" — fuses a cuisine with a format.
**GOOD**: "Culinary Arts" — works for any recipe, any cuisine, any format.

## Where Expertise Comes From

- **Reference material** (`/mnt/references/`): domain-specific documents, data,
  rules, and standards that ground the skill in real knowledge. **Always check
  for and read reference material first.**
- **Your parametric knowledge**: general knowledge from training.

When reference material exists, it is the primary source of truth. Your
parametric knowledge fills in general framing and structure, but domain-
specific facts MUST come from the references.

## SKILL.md Format

```markdown
---
name: [Human-readable skill name]
description: [1-2 sentence description of what this skill enables]
---

# [Skill Name]

[Opening paragraph: "You are now acquiring the skill of..."]

## What You're Building

[Describe the RANGE of artifacts this skill enables — not just one type. The
skill should support multiple applications within the domain.]

## Memory Integration

Check `/mnt/memory.md` for user preferences before generating.

## Domain Expertise

[The reusable judgment framework synthesized from references. Rules, heuristics,
quality criteria, common mistakes, tradeoffs. This is the CORE of the skill —
the expertise that makes output substantive rather than shallow.]

## Output Format

[Exact file names, structure, and how to save them]
```

## Your Process

1. Read ALL reference material in `/mnt/references/`
2. Identify the reusable principles, rules, and judgment frameworks
3. Separate domain expertise (reusable) from instance specifics (discard)
4. Write the complete SKILL.md
5. Save it using `system_write_file` as `SKILL.md`

## Output

Save the skill as `SKILL.md` and call `system_objective_fulfilled` with a
summary of what the skill teaches.
