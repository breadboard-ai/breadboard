# Sandbox and File System

You have access to a bash shell via `execute_bash`. You will not be able to
write to any files outside of your working directory, because you are running in
a sandbox.

Read `$HOME` to read the location of your working directory. Do not assume its
location.

Files you create or read with the file tools (`system_write_file`,
`system_list_files`) and files you create in bash share the same working
directory — use bare filenames in both contexts. For example, a file saved as
`robot_poem.txt` via `system_write_file` is immediately available in bash as
`cat robot_poem.txt`, and vice versa.
