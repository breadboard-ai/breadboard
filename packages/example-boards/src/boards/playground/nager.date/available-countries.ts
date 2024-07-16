import { board, output } from "@breadboard-ai/build";
import { fetch } from "@google-labs/core-kit";

const fetchResult = fetch({
  $metadata: {
    $id: "fetch",
    title: "API Fetch Results",
    description: "Calling the Nager Date API to get the the available countries",
  },
  url: "https://date.nager.at/api/v3/AvailableCountries",
  method: "GET"
});

const countries = output(fetchResult.outputs.response, {
  title: "Available Countries",
  description: "A list of available countries",
});

export default board({
  title: "Nager Date Available Countries API",
  description: "Get the available countries for the Nager Date API",
  version: "0.1.0",
  inputs: { },
  outputs: { countries },
});
