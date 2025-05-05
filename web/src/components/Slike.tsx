import React, {
  useEffect,
  useMemo,
  useState
} from 'react';

import { GraphRiver } from 'components/GraphRiver/GraphRiver';
import { GraphStack } from 'components/GraphStack/GraphStack';
import { useLocation } from 'utils/useLocation';
import './Slike.css';

interface IContextProps {
  location: LatLon;
  lang: string;
  profile: string;
  tz: string;
}

function Forecast({
  location,
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
  }, [profile]);

  // trying out two different graphs here 

  // build data for graph candidate 1: river graph 
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

  // build data for graph candidate 2: stack graph 
  let forecastGraphData2 = useMemo(() => {
    let data: number[][] = [];
    
    if (forecastData) {
      forecastFields.map((field) => {
        let fieldRow: number[] = [];

        forecastData.forecast.map((hour) => {
          const value = parseFloat(hour[field as keyof ForecastHour].replace(/ \(.*\)/g, ''));
          fieldRow.push(value);
        });

        data.push(fieldRow);
      });
    }

    return data;
  }, [forecastData]);

  let forecastGraphData2Hours = useMemo(() => {
    let data: string[] = [];

    if (forecastData) {
      forecastData.forecast.map((hour) => {
        const dt = new Date(hour.time);
        data.push(`${dt.getMonth()}/${dt.getDate()} ${dt.getHours()}:00`);
      });
    }

    return data;
  }, [forecastData]);

  if (!forecastData) {
    return <div className="text-red-500">Failed to fetch forecast data!</div>;
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

      <GraphRiver 
        fields={forecastFields}
        data={forecastGraphData} 
        events={{}} />

      <GraphStack 
        fields={forecastFields}
        data={forecastGraphData2} 
        hours={forecastGraphData2Hours}
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
  location,
  lang,
  profile,
  tz
}: IContextProps) {
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

  if (isLocating) {
    return <div>locating...</div>;
  }

  if (locationError) {
    return <div className="text-red-500">{locationError}</div>;
  }

  return (
    <main>
      <UserDetails
        location={location}
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
        location={location}
        lang={lang}
        profile={selectedProfile}
        tz={tz}
      />
    </main>
  );
}

export default App;
