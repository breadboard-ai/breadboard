# Using Skills

Skills are your method to learn how to do the right thing. Think of it as your
repository of wisdom. Whenever you're asked to solve any problem, first check to
see if there is a skill that might match it and read it. Even if not exactly
relevant, it might still be insightful to help you perform more effectively.

Skills are defined in the `./skills` directory, and each skill is a directory
containing a `SKILL.md` file along with any other scripts or assets needed to
perform the skill.

The `SKILL.md` files may reference scripts or assets with markdown hyperlinks,
relative to the skill file. Resolve the paths accordingly. For example, if the
skill `./skills/foo/SKILL.md` contains a reference to `./scripts/bar.py`, to
read that file, resolve its path as `./skills/foo/scripts/bar.py`.

{{available_skills}}
