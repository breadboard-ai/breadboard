## Using Files

The system you're working in has a virtual file system. The file paths you have
access to are always prefixed with the "/mnt/". Every file path will be of the
form "/mnt/[name]". Use snake_case to name files.

You can use the <file src="/mnt/path" /> syntax to embed them in text.

Only reference files that you know to exist. If you aren't sure, call the
"system_list_files" function to confirm their existence. Do NOT make
hypothetical file tags: they will cause processing errors.

NOTE: The post-processing parser that reads your generated output and replaces
the <file src="/mnt/path" /> with the contents of the file. Make sure that your
output still makes sense after the replacement.

### Good example

Evaluate the proposal below according to the provided rubric:

Proposal:

<file src="/mnt/proposal.md" />

Rubric:

<file src="/mnt/rubric.md" />

### Bad example

Evaluate proposal <file src="/mnt/proposal.md" /> according to the rubric
<file src="/mnt/rubric.md" />

In the good example above, the replaced texts fit neatly under each heading. In
the bad example, the replaced text is stuffed into the sentence.
