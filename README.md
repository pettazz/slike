# slike
'slike, perfect...maybe

this is somewhere between proof of concept and in progress, i'll put some more words here later

TODO
---
- ~~weather API retry/backoff before failing~~
- ~~reuse the same token if its still good~~
- ~~remainder of the hour ttl cache for given coords for weather request~~
- ~~use the actual logger print is not a logger cmon~~
- ~~dockerize it~~
  - ~~intermediate image for scipy/numpy because they take forever to install~~
- ~~local build 'n run script~~
- ~~run on fly~~
- ~~deploy script~~
- ~~migrate from yaml to fly secrets, populate in deploy script and plain env vars in buildnrun script~~
- ~~local docker compose orchestration with redis~~
- ~~fly/upstash redis for prod~~
- ~~read scoring.json into redis at startup, use it to read from when scoring~~
- ~~admin endpoint for scoring ingest to populate redis instead~~
  - ~~split the API call caching and scoring caching, bust scoring when profile is updated~~
- ~~replace async-cache with redis for forecast~~
  - ~~endpoint to force evict all caches~~
- ~~out of memory crashes~~
- ~~figure out the redis reconnection timeouts~~
- ~~multiple scoring profiles~~
  - ~~UI select from available, persist selection in localstorage, include in API calls~~
  - ~~parameterize ingest, read from profiles, everything~~
- choose location instead of gps
  - use openweathermap api for geocoding
- clean old caches values from redis? upstash retention settings?
- remove field scores from forecast response, only tag most impactful 
- admin routes auth
- make a website that don't suck

WISHLIST
---
- add aqi fields
  - nobody has hourly data on this, let alone forecasts, so comparisons are mostly pointless 


### lat long decimal place accuracy

in case you were wondering

| decimal places  | degrees     |  distance
| --------------- | ----------- |  --------
| 0               | 1           |  111  km
| 1               | 0.1         |  11.1 km
| 2               | 0.01        |  1.11 km
| 3               | 0.001       |  111  m
| 4               | 0.0001      |  11.1 m
| 5               | 0.00001     |  1.11 m
| 6               | 0.000001    |  11.1 cm
| 7               | 0.0000001   |  1.11 cm
| 8               | 0.00000001  |  1.11 mm