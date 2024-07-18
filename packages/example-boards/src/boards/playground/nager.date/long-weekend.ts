import { board, enumeration, input, output } from "@breadboard-ai/build";
import { fetch } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { countryCodes } from "../../../utils/countryCodes";

const countryCode = input({
  title: "countryCode",
  type: enumeration(...countryCodes),
  description: "The data for countryCode",
  default: "US"
});

const year = input({
  title: "year",
  type: "string", // TODO: Change this to "number" type when the Template Kit's `urlTemplate` node has been updated to accept number type wildcard inputs.
  description: "The data for year",
  default: new Date().getFullYear().toString(),
});

const url = urlTemplate({
  $id: "url",
  template: "https://date.nager.at/api/v3/LongWeekend/{year}/{countryCode}",
  year: year,
  countryCode: countryCode,
});

const fetchResult = fetch({
  $id: "fetchResult",
  method: "GET",
  url: url.outputs.url,
});

const info = output(fetchResult.outputs.response, {
  title: "Long Weekend Info",
  description: "The long weekend info for the selected country code for the given year from the Nager Date API"
});

export default board({
  title: "Nager Date Long Weekend API",
  description: "API for long weekends",
  version: "0.1.0",
  inputs: { countryCode, year },
  outputs: { info }
});
