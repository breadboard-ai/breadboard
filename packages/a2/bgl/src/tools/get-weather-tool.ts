/**
 * @fileoverview The actual tool that gets the weather.
 */
import fetch from "@fetch";

export { invoke as default, describe };

import { ok, err } from "./a2/utils";
import { executeTool } from "./a2/step-executor";
import { toLLMContent } from "./a2/utils";

const USE_METEO = false;

export type WeatherInputs = {
  location: string;
};

export type WeatherOutputs = {
  weather: WeatherOutput;
};

type GeocodingResults = {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
  }[];
};

type WeatherResults = {
  current: {
    weather_code: number;
    time: string;
    temperature_2m: number;
    is_day: 0 | 1;
    precipitation: number;
    rain: number;
    showers: number;
    snowfall: number;
  };
};

const WEATHER_CODES: Record<string, Conditions> = {
  // Individual codes
  "0": {
    description: "Clear sky",
    category: "clear",
  },

  // Ranges for cloud coverage
  "1": {
    description: "Mainly clear",
    category: "partlyCloudy",
  },
  "2": {
    description: "Partly cloudy",
    category: "partlyCloudy",
  },
  "3": {
    description: "Overcast",
    category: "cloudy",
  },

  // Fog conditions
  "45": {
    description: "Fog",
    category: "fog",
  },
  "48": {
    description: "Depositing rime fog",
    category: "fog",
  },

  // Drizzle intensities
  "51": {
    description: "Light drizzle",
    category: "drizzle",
    intensity: "light",
  },
  "53": {
    description: "Moderate drizzle",
    category: "drizzle",
    intensity: "moderate",
  },
  "55": {
    description: "Dense drizzle",
    category: "drizzle",
    intensity: "heavy",
  },

  // Freezing drizzle
  "56": {
    description: "Light freezing drizzle",
    category: "freezingDrizzle",
    intensity: "light",
  },
  "57": {
    description: "Dense freezing drizzle",
    category: "freezingDrizzle",
    intensity: "heavy",
  },

  // Rain intensities
  "61": {
    description: "Slight rain",
    category: "rain",
    intensity: "light",
  },
  "63": {
    description: "Moderate rain",
    category: "rain",
    intensity: "moderate",
  },
  "65": {
    description: "Heavy rain",
    category: "rain",
    intensity: "heavy",
  },

  // Freezing rain
  "66": {
    description: "Light freezing rain",
    category: "freezingRain",
    intensity: "light",
  },
  "67": {
    description: "Heavy freezing rain",
    category: "freezingRain",
    intensity: "heavy",
  },

  // Snow intensities
  "71": {
    description: "Slight snow fall",
    category: "snow",
    intensity: "light",
  },
  "73": {
    description: "Moderate snow fall",
    category: "snow",
    intensity: "moderate",
  },
  "75": {
    description: "Heavy snow fall",
    category: "snow",
    intensity: "heavy",
  },

  // Snow grains
  "77": {
    description: "Snow grains",
    category: "snowGrains",
  },

  // Rain showers
  "80": {
    description: "Slight rain showers",
    category: "rainShowers",
    intensity: "light",
  },
  "81": {
    description: "Moderate rain showers",
    category: "rainShowers",
    intensity: "moderate",
  },
  "82": {
    description: "Violent rain showers",
    category: "rainShowers",
    intensity: "violent",
  },

  // Snow showers
  "85": {
    description: "Slight snow showers",
    category: "snowShowers",
    intensity: "light",
  },
  "86": {
    description: "Heavy snow showers",
    category: "snowShowers",
    intensity: "heavy",
  },

  // Thunderstorm
  "95": {
    description: "Thunderstorm",
    category: "thunderstorm",
    intensity: "moderate",
  },

  // Thunderstorm with hail
  "96": {
    description: "Thunderstorm with slight hail",
    category: "thunderstormWithHail",
    intensity: "light",
  },
  "99": {
    description: "Thunderstorm with heavy hail",
    category: "thunderstormWithHail",
    intensity: "heavy",
  },
};

type Conditions = {
  description: string;
  category: string;
  intensity?: string;
};

type WeatherOutput = {
  location: string;
  conditions: Conditions;
  time: string;
  temperature: string;
  is_day: boolean;
  precipitation: string;
  snowfall?: boolean;
  rain?: boolean;
  showers?: boolean;
};

function geocodingUrl(location: string) {
  return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=10&language=en&format=json`;
}

function weatherUrl(latitude: number, longitude: number) {
  // current=temperature_2m,is_day,precipitation,rain,showers,snowfall&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=1
  return `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=weather_code,temperature_2m,is_day,precipitation,rain,showers,snowfall&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=1`;
}

function getConditions(weather_code: number): Conditions {
  const code = `${weather_code}`;
  const conditions = WEATHER_CODES[code];
  return conditions;
}

async function invoke({
  location,
}: WeatherInputs): Promise<Outcome<LLMContent>> {
  if (!USE_METEO) {
    const executing = await executeTool<string>("get_weather", {
      location,
    });
    if (!ok(executing)) return executing;
    return toLLMContent(executing);
  }
  const geocodingResponse = await fetch({ url: geocodingUrl(location) });
  if ("$error" in geocodingResponse) {
    return { $error: geocodingResponse.$error as string };
  }
  const geocodingResults = geocodingResponse.response as GeocodingResults;
  if (!geocodingResults.results) {
    return { $error: `No results for location: "${location}"` };
  }
  const { latitude, longitude } = geocodingResults.results.at(0) || {};
  if (!latitude || !longitude) {
    return { $error: `No latitude/longitude for location: "${location}"` };
  }
  const weatherResponse = await fetch({ url: weatherUrl(latitude, longitude) });
  if ("$error" in weatherResponse) {
    return { $error: weatherResponse.$error as string };
  }
  const { current } = weatherResponse.response as WeatherResults;

  const precipitation = current.precipitation
    ? `${current.precipitation} inches`
    : "none";
  const weather: WeatherOutput = {
    location,
    conditions: getConditions(current.weather_code),
    time: current.time,
    is_day: current.is_day == 1,
    precipitation,
    temperature: `${current.temperature_2m} F`,
  };
  if (current.showers) {
    weather.showers = true;
  }
  if (current.snowfall) {
    weather.snowfall = true;
  }
  if (current.rain) {
    weather.rain = true;
  }
  const result = JSON.stringify(weather, null, 2);
  return toLLMContent(result);
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          title: "Location",
          description: "The name of the city",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        weather: {
          type: "object",
          title: "Current Weather",
        },
      },
    } satisfies Schema,
  };
}
