// export default Ajv;
import { Schema, SchemaDraft, ValidationResult, Validator } from "@cfworker/json-schema";
import breadboardSchema from "@google-labs/breadboard-schema/breadboard.schema.json" assert { type: "json" };
import assert from "node:assert";
import { describe, test } from "node:test";
import { GraphDescriptor, board } from "../src/index.js";

test("some test", (t) => {
  assert.equal(1 + 1, 2);
});

describe("can create a board", async (t) => {
  // const board: Board = new Board();
  const bb: GraphDescriptor = await board().serialize();

  test("board is defined", () => {
    assert.ok(board);
  });

  test("board is an object", () => {
    assert.equal(typeof board, "object");
  });

  test("board has a nodes array", () => {
    assert.ok(bb.nodes);
  });

  test("board has a nodes property", () => {
    assert.ok(bb.nodes);
  });

  test("board has a nodes property that is an array", () => {
    assert.ok(Array.isArray(bb.nodes));
  });

  test("board has a nodes property that is an array of length 0", () => {
    assert.equal(bb.nodes.length, 0);
  });

  test("board has a edges property", () => {
    assert.ok(bb.edges);
  });

  test("board has a edges property that is an array", () => {
    assert.ok(Array.isArray(bb.edges));
  });

  test("board has a edges property that is an array of length 0", () => {
    assert.equal(bb.edges.length, 0);
  });


  test("board has a kits property", () => {
    assert.ok(bb.kits);
  });

  test("board has a kits property that is an array", () => {
    assert.ok(Array.isArray(bb.kits));
  });

  test("board has a kits property that is an array of length 0", () => {
    assert.ok(bb.kits);
    assert.equal(bb.kits.length, 0);
  });
});

test("board is created with correct title", async (t) => {
  const title = "My Board";

  const bb: GraphDescriptor = await board().serialize({
    title
  });
  assert.equal(bb.title, title);
});

const shortCircuit = false;
const draft: SchemaDraft = "2020-12";
const breadboardValidator = new Validator(breadboardSchema as Schema, draft, shortCircuit);

describe("schema tests", async (t) => {

  await test("board has something that looks like a schema", async (t) => {
    const bb: GraphDescriptor = await board().serialize();
    const schema = bb.$schema;

    await t.test("schema is defined", (t) => {
      assert.ok(schema);
    });
    assert.ok(schema);

    await t.test("schema is a valid uri", (t) => {
      assert.match(schema, /^https?:\/\/.*/);
    });

    await t.test("schema can be resolved", (t) => {
      assert.doesNotThrow(() => new URL(schema));
    });
    // assert that url can be fetched
    await t.test("schema can be fetched", (t) => {
      assert.doesNotThrow(() => fetch(schema));
    });
  });

  await test("validator that the validator validates", async (t) => {
    const bb: GraphDescriptor = await board().serialize();
    const boardJson = JSON.parse(JSON.stringify(bb));
    const result: ValidationResult = breadboardValidator.validate(boardJson);
    assert.ok(result.valid);
    assert.ok(result.errors.length === 0);
  });

  await test("validate using the schema from a board", async (t) => {
    const bb: GraphDescriptor = await board().serialize();
    const boardJson = JSON.parse(JSON.stringify(board));
    const schemaId = bb.$schema;

    // assert that schemaId is defined
    assert.ok(schemaId);
    const schema = await (await fetch(schemaId)).json();

    // assert that schema is defined
    assert.ok(schema);

    // assert that it's an object
    assert.equal(typeof schema, "object");

    const validator = new Validator(schema, draft, shortCircuit);
    const result: ValidationResult = validator.validate(boardJson);
    // validation should pass
    assert.ok(result.valid);
    // there should be no errors
    assert.ok(result.errors.length === 0);
  });

  await test("validate using a schema that is missing a required property", async (t) => {
    const property = "edges";

    const schema = JSON.parse(JSON.stringify(breadboardSchema));
    // assert that edges property is defined
    assert.ok(schema.properties[property]);

    // assert that edges is required
    assert.ok(schema.required?.includes(property));

    delete schema.properties[property];
    // assert that edges is missing
    assert.ok(!schema.properties[property]);

    const bb: GraphDescriptor = await board().serialize();
    const boardJson = JSON.parse(JSON.stringify(bb));

    const validator = new Validator(schema, draft, shortCircuit);
    const result: ValidationResult = validator.validate(boardJson);

    // validation should fail because edges is required
    assert.ok(!result.valid);
    assert.ok(result.errors.length > 0);
  });

  await test("validate using an empty schema", async (t) => {
    const schema: Schema = {
      type: "object",
      maxProperties: 0,
    };

    const bb: GraphDescriptor = await board().serialize();
    const boardJson = JSON.parse(JSON.stringify(bb));

    const validator: Validator = new Validator(schema, draft, shortCircuit);
    const result: ValidationResult = validator.validate(boardJson);

    // validation should fail because boardJson has more than 0 properties
    assert.ok(!result.valid);
    // there should be errors
    assert.ok(result.errors.length > 0);
  });

  await test("validate using a schema that requires extra properties", async (t) => {
    const potatoes = "potatoes";
    const schema = {
      ...breadboardSchema,
      required: breadboardSchema.required.concat([potatoes]),
      properties: {
        ...breadboardSchema.properties,
        [potatoes]: {
          type: "string",
        },
      }
    };

    // assert the schema has the required additional property
    assert.ok(schema.required.includes(potatoes));
    assert.ok(schema.properties[potatoes]);


    const bb: GraphDescriptor = await board().serialize();
    const boardJson = JSON.parse(JSON.stringify(bb));

    const validator: Validator = new Validator(schema as Schema, draft, shortCircuit);
    const result: ValidationResult = validator.validate(boardJson);

    // validation should fail because nodes is required
    assert.ok(!result.valid);
    // there should be errors
    assert.ok(result.errors.length > 0);


    const boardWithAdditionalProperty = {
      ...bb,
      [potatoes]: "yummy"
    };

    const boardWithAdditionalPropertyJson = JSON.parse(JSON.stringify(boardWithAdditionalProperty));
    const result2: ValidationResult = validator.validate(boardWithAdditionalPropertyJson);

    console.log(result2);
    // validation should pass because boardWithAdditionalPropertyJson has the required additional property
    assert.ok(result2.valid);
    // there should be no errors
    assert.ok(result2.errors.length === 0);
  });
});
