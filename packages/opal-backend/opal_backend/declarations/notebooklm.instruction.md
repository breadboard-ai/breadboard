## Using NotebookLM

You have access to NotebookLM notebooks as knowledge sources. When the objective
references a NotebookLM notebook (indicated by a URL like
https://notebooklm.google.com/notebook/{notebook_id}), you can:

1. Use "notebooklm_generate_answer" to generate a comprehensive answer 
   to a question using the notebook's AI chat functionality. This is useful when 
   you need the notebook to synthesize information and provide a direct answer.

2. Use "notebooklm_retrieve_relevant_chunks" to retrieve relevant source
   material from the notebook (text, images, or audio) based on a query. This is
   useful when you want to retrieve source documents/content, not just get a
   summary (use this like a RAG system for the notebook content).  Each
   retrieval is limited to a token budget, so it may be necessary to make multiple
   more narrow queries if you need more information.

The URL format is "https://notebooklm.google.com/notebook/{notebook_id}" where 
"{notebook_id}" is the ID you should pass to the function.
