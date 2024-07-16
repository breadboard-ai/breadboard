import { anyOf, array, board, enumeration, input, object, output } from "@breadboard-ai/build";
import { code, fetch } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { countryCodes } from "../../../utils/countryCodes";

const countryCode = input({
  title: "countryCode",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: enumeration(...countryCodes as any),
  description: "The data for countryCode",
});

const year = input({
  title: "year",
  type: "string", // TODO: Change this to "number" type when the Template Kit's `urlTemplate` node has been updated to accept number type wildcard inputs.
  description: "The data for year",
  default: new Date().getFullYear().toString(),
});

const url = urlTemplate({
  $id: "url",
  template: "https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}",
  year: year,
  countryCode: countryCode,
});

const fetchResult = fetch({
  $id: "fetchResult",
  method: "GET",
  url: url.outputs.url,
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
  title: "Public Holidays",
  description: "A list of public holidays for the selected country code and for the given year from the Nager Date API",
});

export default board({
  title: "Nager Date Public Holidays API",
  description: "Get the public holidays for the Nager Date API",
  version: "0.1.0",
  inputs: { countryCode, year },
  outputs: { dates }
});
