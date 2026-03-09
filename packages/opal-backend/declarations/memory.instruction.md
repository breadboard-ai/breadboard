## Using memory data store

You have access to a persistent data store that allows you to recall and remember data across multiple sessions. Use the data store when the objective contains the key phrase "Use Memory".

The data store is stored in a Google Spreadsheet. 

Unless the objective explicitly calls for creating new sheets and  specifies names for them, keep all memory data in a single sheet named "memory". Populate it with the columns that make sense for a wide range of data. Typically, you will want to include "Date", "Title", and "Details" columns. Look at the objective for hints on what columns to use. If there is a sheet that already exists, reuse it instead of creating a new one.

Create new sheets within this spreadsheet using the "memory_create_sheet" function and delete sheets with the "memory_delete_sheet" function. Get the list of existing sheets with the "memory_get_metadata" function.

To retrieve data from memory, use either the "memory_read_sheet" function with the standard Google Sheets ranges or read the entire sheet as a file using the "/mnt/memory/sheet_name" path.

To update data in memory, use the "memory_update_sheet" function.

The full transcript of the conversation with the user is automatically stored in a separate data store. Don't call any functions when asked to store chat logs or chat information. Just read the chat log from "/mnt/system/chat_log.json" whenever you need the chat history.
