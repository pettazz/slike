declare type LatLon = {
  lat: number;
  lon: number;
  accuracy: number;
};

// TODO: clean this up to match updated backend
declare type ForecastMeta = {
  country: string;
  local: string;
};

declare type ForecastHour = {
  cloudCover: string;
  daylight: string;
  precipitationChance: string;
  precipitationIntensity: string;
  precipitationType: string;
  score: number;
  temperature: string;
  temperatureDewPoint: string;
  time: string;
  uvIndex: string;
  windSpeed: string;
  windGust: string;
};

declare type ForecastData = {
  forecastFetchTime: number;
  forecast: ForecastHour[];
  meta: ForecastMeta;
};
