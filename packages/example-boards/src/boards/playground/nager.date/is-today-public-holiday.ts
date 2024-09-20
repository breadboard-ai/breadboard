import { board, enumeration, input, output } from "@breadboard-ai/build";
import { fetch, code } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { countryCodes } from "../../../utils/countryCodes";

const countryCode = input({
  title: "countryCode",
  type: enumeration(...countryCodes),
  description: "The data for countryCode",
  default: "US"
});

const offset = input({
  title: "offset",
  type: "number",
  description: "utc timezone offset",
  default: 0,
});

const validatedOffset = code(
  {
    $id: "validatedOffset",
    offset
  },
  { offset: "number" },
  ({ offset }) => {
    if (offset > 12 || offset < -12) {
      throw new Error(`Invalid offset input: ${offset}. Offset must be maximum 12 and minimum -12.`);
    }
    return { offset }
  });

const url = urlTemplate({
  $id: "urlTemplate",
  template: "https://date.nager.at/Api/v3/IsTodayPublicHoliday/{countryCode}?{&offset}",
  countryCode: countryCode,
  offset: validatedOffset.outputs.offset,
});

const fetchResult = fetch({
  $id: "fetchResult",
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

const publicHolidayResult = output(statusCodeToResult.outputs.isPublicHoliday, {
  title: "Public Holiday Result",
  description: "A boolean indicating if today is a bank holiday for the given country code from the Nager Date API",
});

export default board({
  title: "Is Today a Public Holiday",
  description: "Get the public holidays for today for the Nager Date API",
  version: "0.1.0",
  inputs: { countryCode, offset },
  outputs: { publicHolidayResult }
});
