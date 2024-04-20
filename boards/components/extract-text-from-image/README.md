# Extract Text from Image

This component extracts text from an image using the Gemini vision API.

## Inputs

- image - The image to extract text from. The format is expected to be base64 encoded

e.g

```json
{
  "inline_data": {
    "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/4QA6RXhpZgAATU0AKgAAAAgAA1IBAAABAAEA...",
    "mime_type": "image/jpeg"
  }
}
```

## Outputs

- text - The extracted text
