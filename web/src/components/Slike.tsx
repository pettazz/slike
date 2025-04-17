import React, {
  useEffect,
  useMemo,
  useState
} from 'react';

import { Graph } from 'components/Graph/Graph';
import { useLocation } from 'utils/useLocation';
import './Slike.css';

interface IContextProps {
  isLocating: boolean;
  location: LatLon;
  locationError: string | null;
  lang: string;
  profile: string;
  tz: string;
}

function Forecast({
  isLocating,
  location,
  locationError,
  lang,
  profile,
  tz
}: IContextProps) {
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const forecastFields = [
    'daylight',
    'precipitationChance',
    'temperature',
    'precipitationIntensity',
    'precipitationType',
    'temperatureDewPoint',
    'windSpeed',
    'uvIndex',
    'windGust',
    'cloudCover'
  ];

  useEffect(() => {
    if (!isLocating && !locationError) {
      const params = new URLSearchParams({
        lat: `${location.lat}`,
        lon: `${location.lon}`,
        lang: lang,
        tz: tz,
        profile: profile
      });

      fetch('/forecast?' + params)
        .then((response) => response.json())
        .then((response) => {
          setForecastData(response);
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }, [isLocating, profile]);

  let forecastGraphData = useMemo(() => {
    let data: [string, number, string][] = [];
    
    if (forecastData) {
      forecastData.forecast.map((hour) => {
        forecastFields.map((field) => {
          const dt = new Date(hour.time),
                value = parseFloat(hour[field as keyof ForecastHour].replace(/ \(.*\)/g, ''));
          data.push([dt.toISOString(), value, field]);
        });
      });
    }

    return data;
  }, [forecastData]);

  if (isLocating || locationError || !forecastData) {
    return;
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-lime-700">forecast data</h2>
      <h3 className="text-1xl font-bold text-lime-700">
        {forecastData.meta.local}, {forecastData.meta.country}
      </h3>
      <p>
        fields displayed are weighted scores with raw values in parenthesis
        (metric where applicable)
      </p>
      <p>
        last updated{' '}
        <span className="font-bold">
          {new Date(forecastData.forecastFetchTime).toLocaleString()}
        </span>{' '}
        (results are cached per location until the top of each hour)
      </p>
      <table>
        <thead>
          <tr>
            <td key="time">
              <strong>time</strong>
            </td>
            {forecastFields.map((field) => {
              return (
                <td key={field}>
                  <strong>{field}</strong>
                </td>
              );
            })}
            <td key="score">
              <strong>score</strong>
            </td>
          </tr>
        </thead>
        <tbody>
          {forecastData.forecast.map((hour) => {
            const dt = new Date(hour.time);
            
            return (
              <tr key={hour.time}>
                <td key="time">{`${dt.getMonth()}/${dt.getDate()} ${dt.getHours()}:00`}</td>
                  {forecastFields.map((field) => {
                    return <td key={field}>{hour[field as keyof ForecastHour]}</td>;
                  })}
                <td key="score">{hour.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Graph 
        fields={forecastFields}
        data={forecastGraphData} 
        events={{}} />
    </section>
  );
}

interface IProfileProps {
  selectedProfile: string;
  onChange: React.ChangeEventHandler;
}

function Profile({ selectedProfile, onChange }: IProfileProps) {
  const [profiles, setProfiles] = useState<string[]>([selectedProfile]);

  useEffect(() => {
    fetch(`/profiles`)
      .then((response) => response.json())
      .then((response) => {
        setProfiles(
          response.map((profile: string) => profile.slice('scoring:'.length))
        );
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  return (
    <section>
      <h2 className="text-2xl font-bold text-lime-700">profile</h2>
      <select onChange={onChange}>
        {profiles.map((profile: string) => {
          return (
            <option key={profile} value={profile}>
              {profile}
            </option>
          );
        })}
      </select>
    </section>
  );
}

function UserDetails({
  isLocating,
  location,
  locationError,
  lang,
  profile,
  tz
}: IContextProps) {
  if (isLocating) {
    return <div>locating...</div>;
  }

  if (locationError) {
    return <div className="text-red-500">{locationError}</div>;
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-lime-700">your info</h2>
      <table>
        <tbody>
          <tr>
            <td>
              <strong>latitude</strong>
            </td>
            <td id="lat">{location.lat}</td>
          </tr>
          <tr>
            <td>
              <strong>longitude</strong>
            </td>
            <td id="lon">{location.lon}</td>
          </tr>
          <tr>
            <td>
              <strong>accuracy</strong>
            </td>
            <td id="accuracy">{location.accuracy}</td>
          </tr>
          <tr>
            <td>
              <strong>language</strong>
            </td>
            <td id="lang">{lang}</td>
          </tr>
          <tr>
            <td>
              <strong>timezone</strong>
            </td>
            <td id="tz">{tz}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function App() {
  const { isLocating, location, locationError } = useLocation();
  const lang = window.navigator.language,
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const initialProfile =
      localStorage.getItem('userconfig.lastSelectedProfile') || 'default',
    [selectedProfile, setSelectedProfile] = useState<string>(initialProfile);

  return (
    <main>
      <UserDetails
        isLocating={isLocating}
        location={location}
        locationError={locationError}
        lang={lang}
        profile={selectedProfile}
        tz={tz}
      />
      <Profile
        selectedProfile={selectedProfile}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
          setSelectedProfile(e.target.value);
        }}
      />
      <Forecast
        isLocating={isLocating}
        location={location}
        locationError={locationError}
        lang={lang}
        profile={selectedProfile}
        tz={tz}
      />
    </main>
  );
}

export default App;
