---
layout: docs.liquid
title: Google Drive Kit
tags:
  - kits
  - wip
---

{% assign src_url = "https://github.com/breadboard-ai/breadboard/tree/main/packages/google-drive-kit/src/components/" %}

Google Drive Kit lets you search for, read, and write files in your Google Drive. The components in this kit closely mirror the official [Google
Drive API](https://developers.google.com/drive/api/guides/about-sdk).

## Get File Content

Use the `getFileContent` component to retrieve the raw bytes of a regular file in Google Drive.

> [!TIP]
> To read a Google Doc or Sheet, use the [Export File](#export-file) component
> instead of the Get File Content. Google Workspace files do not use standard
> file formats, so it is not possible to read them without first converting them
> to a standard format like plain text, HTML or CSV.

### Input ports

- **`fileId`**: The ID of the Google Drive file whose content to retrieve. See [`fileId`](https://developers.google.com/drive/api/reference/rest/v3/files/get#body.PATH_PARAMETERS.file_id) in the Google Drive API documentation.

### Output ports

- **`content`**: The bytes of the file.

### Implementation

- [get-file-content.ts]({{src_url}}get-file-content.ts)

## Export File

Use the `exportFile` component to convert a Google Workspace file like a Doc or Sheet to a standard format like text, HTML, or PDF.

### Input ports

- **`fileId`**: The ID of the Google Drive Workspace file to export. See [`fileId`](https://developers.google.com/drive/api/reference/rest/v3/files/get#body.PATH_PARAMETERS.file_id) in the Google Drive API documentation.

- **`mimeType`**: MIME type of the format that the file should be converted to. See [`mimeType`](https://developers.google.com/drive/api/reference/rest/v3/files/export#body.QUERY_PARAMETERS.mime_type) in the Google Drive API documentation.

  Google Docs can be converted to `text/plain`, `text/markdown`, `text/html`, `application/pdf`, and [more](https://developers.google.com/drive/api/guides/ref-export-formats). Google Sheets can be converted to `text/csv`, `application/pdf`, and [more](https://developers.google.com/drive/api/guides/ref-export-formats).

### Output ports

- **`content`**: A string containing the bytes of the file. See
  [`Response Body`](https://developers.google.com/drive/api/reference/rest/v3/files/export#response-body)
  in the Google Drive API documentation.

### Implementation

- [export-file.ts]({{src_url}}export-file.ts)

## List files

Use the `listFiles` component to search for files in your Google Drive matching
certain criteria, such as type or parent folder.

### Input ports

- **`query`**: A Google Drive search query. See [search
  files](https://developers.google.com/drive/api/guides/search-files) in the
  Google Drive API Documentation for details on the syntax.

  Examples:

  - All images in a folder:
    ```
    mimeType contains 'image/' and '<folder-id>' in parents
    ```

### Output ports

- **`files`**: The array of files that matched. See
  [`files`](https://developers.google.com/drive/api/reference/rest/v3/files/list#body.FileList.FIELDS.files)
  in the Google Drive API Documentation.

- **`nextPageToken`**: If there are too many files to fit in one page, a token for the next page of files. See [`nextPageToken`](https://developers.google.com/drive/api/reference/rest/v3/files/list#body.FileList.FIELDS.next_page_token) in the Google Drive API documentation.

- **`incompleteSearch`**: Whether the search process was incomplete. See
  [`incompleteSearch`](https://developers.google.com/drive/api/reference/rest/v3/files/list#body.FileList.FIELDS.incomplete_search)
  in the Google Drive API documentation.

### Implementation

- [list-files.ts]({{src_url}}list-files.ts)
