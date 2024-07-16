import { board, enumeration, input, output } from "@breadboard-ai/build";
import { fetch, code } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { countryCodes } from "../../../utils/countryCodes";

const countryCode = input({
  title: "countryCode",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: enumeration(...countryCodes as any),
  description: "The data for countryCode",
});

const offset = input({
  title: "offset",
  type: "string", // TODO: Change this to "number" type when the Template Kit's `urlTemplate` node has been updated to accept number type wildcard inputs.
  description: "utc timezone offset",
  default: "0",
});

const validatedOffset = code(
  {
    $id: "validatedOffset",
    offsetString: offset
  },
  { offset: "string" },
  ({ offsetString }) => {
    const offset = Number(offsetString);
    if (isNaN(offset) || offset > 12 || offset < -12) {
      throw new Error(`Invalid offset input: ${offsetString}. Offset must be maximum 12 and minimum -12.`);
    }
    return { offset: offsetString }
  });

const url = urlTemplate({
  $id: "urlTemplate",
  template: "https://date.nager.at/Api/v3/IsTodayPublicHoliday/{countryCode}?{&offset}",
  countryCode: countryCode,
  offset: validatedOffset.outputs.offset,
});

const fetchResult = fetch({
  $id: "fetch",
  raw: true,
  method: "GET",
  url: url.outputs.url,
});

const statusCodeToResult = code(
  {
    $id: "statusCodeToResult",
    status: fetchResult.outputs.status
  },
  { isPublicHoliday: "boolean" },
  ({ status }: { status: number; }): {
    isPublicHoliday: boolean;
  } => {
    if (status === 200) {
      return {
        isPublicHoliday: true,
      };
    } else if (status === 204) {
      return {
        isPublicHoliday: false,
      };
    }
    throw new Error(`Unexpected status code: ${status}`);
  }
);

const isPublicHoliday = output(statusCodeToResult.outputs.isPublicHoliday, {
  title: "Public Holiday Result",
  description: "A boolean indicating if today is a bank holiday for the given country code from the Nager Date API",
});

export default await board({
  title: "Is Today a Public Holiday",
  description: "Get the public holidays for today for the Nager Date API",
  version: "0.1.0",
  inputs: { countryCode, offset },
  outputs: { isPublicHoliday }
});
