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

const url = urlTemplate({
  $id: "url",
  template: "https://date.nager.at/api/v3/CountryInfo/{countryCode}",
  countryCode: countryCode
});

const fetchResult = fetch({
  $id: "fetchResult",
  method: "GET",
  url: url.outputs.url,
});

const info = output(fetchResult.outputs.response, {
  title: "Country Info",
  description: "The country info for the selected country code from the Nager Date API"
});

export default board({
  title: "Nager Date Country Info API",
  description: "Get the country info for the Nager Date API",
  version: "0.1.0",
  inputs: { countryCode },
  outputs: { info },
});
