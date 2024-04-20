# Create an object from a JSON schema

Sometimes you need to create a JSON object. This board will take a JSON schema and a text description of the object and try and create the object.

Behind the scenes, it uses an Gemini to generate the JSON object from the schema and it then validates the object against the schema. If it fails it uses the error message to ask the user for more data and then attempts to regenerate it the object again.

## Running the Board

```bash
breadboard run boards/components/create-object-from-schema/create-object-from-schema.json --kit @google-labs/core-kit --kit @google-labs/agent-kit  -i "{\\"theSchema\\": {\"$id\":\"https://example.com/person.schema.json\",\"$schema\":\"https://json-schema.org/draft/2020-12/schema\",\"title\":\"Person\",\"type\":\"object\",\"properties\":{\"firstName\":{\"type\":\"string\",\"description\":\"The person's first name.\"},\"lastName\":{\"type\":\"string\",\"description\":\"The person's last name.\"},\"age\":{\"description\":\"Age in years which must be equal to or greater than zero.\",\"type\":\"integer\",\"minimum\":0}}}, \"text\": \"Paul Kinlan aged 101 }"
```

### Inputs

- theSchema - The JSON schema that you want to create an object from.
- text - The text that will describe how to create the object

### Outputs

- json - The json object that was created from the schema (and validated) and the text
