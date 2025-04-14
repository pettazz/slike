import { useState, useEffect } from 'react';

const defaultLatLng: LatLon = { lat: 0, lon: 0, accuracy: 0 };
const defaultSettings = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
};

export function useLocation(givenSettings = {}) {
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [location, setLocation] = useState<LatLon>(defaultLatLng);
  const [locationError, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.error('Browser has no geolocation support');
      setError('Your device or browser does not support location services');
      setIsLocating(false);

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos: GeolocationPosition) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setIsLocating(false);
      },
      (err) => {
        console.error(err);

        let msg = 'There was a problem finding your location';
        if ('code' in err && err.code == 1) {
          msg = 'slike does not have permission to use location services';
        }

        setError(msg);
        setIsLocating(false);
      },
      { ...defaultSettings, ...givenSettings }
    );
  }, [givenSettings]);

  return { isLocating, location, locationError };
}
