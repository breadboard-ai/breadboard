import { anyOf, array, board, object, output } from "@breadboard-ai/build";
import { fetch, code } from "@google-labs/core-kit";

const fetchResult = fetch({
  $id: "fetch",
  method: "GET",
  url: "https://date.nager.at/api/v3/NextPublicHolidaysWorldwide",
});

const spreadNagerDateResponse = code(
  {
    $id: "spreadResponse",
    $metadata: {
      title: "Spread",
      description: "Spread the properties of the Nager Date response into a new object",
    },
    obj: fetchResult.outputs.response
  },
  {
    results: array(
      object({
        date: "string",
        localName: "string",
        name: "string",
        countryCode: "string",
        fixed: "boolean",
        global: "boolean",
        counties: anyOf(array("string"), "null"),
        launchYear: anyOf("number", "null"),
        types: array("string"),
      }))
  },
  ({ obj }) => {
    if (typeof obj !== "object") {
      throw new Error(`object is of type ${typeof obj} not object`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { results: { ...obj } } as any;
  }
);

const dates = output(
  spreadNagerDateResponse.outputs.results, {
  title: "Public Holidays Worldwide",
  description: "A list of public holidays worldwide from the Nager Date API",
});

export default board({
  title: "Nager Date Next Public Holidays Worldwide API",
  description: "Get the next public holidays worldwide for the Nager Date API",
  version: "0.1.0",
  inputs: {},
  outputs: { dates }
});
