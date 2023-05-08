import asyncio
import base64
import json as JSON
import os
from datetime import datetime, timedelta

import httpx
from httpx import ReadTimeout
from httpx._exceptions import HTTPStatusError
import pytz
import redis.asyncio as redis
import reverse_geocode
from authlib.jose import jwt
from cache import AsyncTTL, AsyncLRU
from sanic import Sanic
from sanic.exceptions import SanicException
from sanic.log import logger
from sanic.response import json, file, text

from config import Config

app = Sanic('slike')

app.static("/assets/", "web/assets/")

@app.before_server_start
async def bootstrap_scoring(app):
  app.ctx.scoring_kv = redis.Redis(
    host=os.getenv('SLIKE_REDIS_HOST'),
    password=os.getenv('SLIKE_REDIS_PASSWORD'),
    port=Config().redis.port, 
    decode_responses=True
  )

  app.ctx.profile_ingests = {}
  with open(Config().scoring_location, 'rb') as f:
    scoring_data = f.read()
  await setScorer('default', scoring_data)

@app.route('/')
async def hello(request):
  return await file('web/index.html')

@app.route('/profiles')
async def profiles(request):
  keys = await app.ctx.scoring_kv.keys('scoring:*')
  return json(keys)

@app.route('/forecast')
async def forecast(request):
  lang = request.args.get('lang')
  tz = request.args.get('tz')
  lat = request.args.get('lat')
  lon = request.args.get('lon')

  logger.debug("coords requested (%s, %s)" % (lat, lon))

  if Config().geocache.enabled:
    lat = ('%.' + str(Config().geocache.latlng_decimals) + 'f') % float(lat)
    lon = ('%.' + str(Config().geocache.latlng_decimals) + 'f') % float(lon)
    logger.debug("coords rounded to (%s, %s)" % (lat, lon))

  coords = reverse_geocode.search([(lat, lon)])
  country =coords[0]['country_code']
  local = coords[0]['city']
  logger.debug("revgeo'd to %s, %s" % (country, local))

  if Config().geocache.enabled:
    fetch_timestamp, forecast = await cacheableGetForecast(lat, lon, lang, country, tz)
  else:
    fetch_timestamp, forecast = await getForecast(lat, lon, lang, country, tz)

  scored_results = await doScoring(forecast, 'default', app.ctx.profile_ingests['default'])

  result = {
    'meta': {
      'country': country,
      'local': local
    },
    'forecastFetchTime': fetch_timestamp,
    'forecast': scored_results
  }

  return json(result)

@app.put('/ingest/scoring')
async def ingest(request):
  new_data = request.body
  # validate jsonschema?
  await setScorer('default', new_data)
  return text('OK')


async def setScorer(name, new_data):
  await app.ctx.scoring_kv.set('scoring:%s' % name, new_data)
  app.ctx.profile_ingests[name] = datetime.now().timestamp()

@AsyncTTL(maxsize=1024, time_to_live=((datetime.now() + timedelta(hours=1)).replace(microsecond=0, second=0, minute=0) - datetime.now()).seconds)
async def cacheableGetForecast(lat, lon, lang, country, tz):
  logger.debug("using cacheable forecast")
  return await getForecast(lat, lon, lang, country, tz)

async def getForecast(lat, lon, lang, country, tz):
  logger.debug("getting forecast")
  bearer = check_token()
  headers = {"Authorization": "Bearer %s" % bearer.decode('utf-8')}

  url = f"https://weatherkit.apple.com/api/v1/weather/{lang}/{lat}/{lon}?countryCode={country}&timezone={tz}&dataSets=forecastHourly,forecastNextHour"
  async with httpx.AsyncClient() as client:
    for attempt in range(Config().retry.attempts + 1):
      try: 
        r = await client.get(url, headers=headers)
        r.raise_for_status()
        break
      except (HTTPStatusError, ReadTimeout) as err:
        status = '408x' if type(err) == ReadTimeout else err.response.status_code
        if attempt == Config().retry.attempts:
          logger.debug("out of retry attempts")
          raise SanicException("Unable to reach WeatherKit (Read Timeout)", status_code=503)
        elif status not in Config().retry.codes:
          logger.debug("non retryable status %s" % status)
          raise SanicException("Unable to reach WeatherKit (%s)" % status, status_code=503)
        else:
          logger.debug("attempt %s failed (%s), retrying..." % (attempt, status))
          await asyncio.sleep(attempt * Config().retry.backoff)
          continue

  return (datetime.now().isoformat(), r.json())

@AsyncLRU(maxsize=128)
async def doScoring(forecast_data, profile, profile_cache_buster):
  logger.debug('doing a new scoring')
  scoring_data = await app.ctx.scoring_kv.get('scoring:%s' % profile)
  forecast = []

  for h, hour in enumerate(forecast_data['forecastHourly']['hours']):
    row = {}
    hour_total = 0

    row['time'] = hour['forecastStart']

    for scorer in JSON.loads(scoring_data):
      val = raw_val = hour[scorer['name']]
      if scorer['translation']:
        # try for missing enum here
        val = scorer['translation'][str(val)]
      diff = val - scorer['ideal']
      if scorer['absolute']:
        diff = abs(diff)
      if scorer['func']:
        diff = func(scorer['func'], diff)
      score = diff * scorer['normalizer'] * scorer['weight']
      
      row[scorer['name']] = '%.2f (%s)' % (score, raw_val)

      hour_total = hour_total + score

    row['score'] = '%.2f' % hour_total

    forecast.append(row)

  return forecast

def func(name, val):
  match name:
    case 'exp':
      retval = (0.33 * val) ** 2
    case 'sq':
      retval = val ** 2
    case _:
      retval = val

  return retval

def check_token():
  if hasattr(app.ctx, 'bearer') and hasattr(app.ctx, 'bearer_exp') and app.ctx.bearer_exp > datetime.now().timestamp():
    logger.debug("reusing token")
    return app.ctx.bearer
  else:
    return new_token()

def new_token():
  now = datetime.now()
  exp = now + timedelta(minutes=Config().jwt_ttl_mins)

  protected = {
    'alg': 'ES256',
    'kid': os.getenv('SLIKE_SECRET_KEYID'),
    'id': '%s.%s' % (os.getenv('SLIKE_SECRET_TEAMID'), os.getenv('SLIKE_SECRET_SERVICEID'))
  }
  payload = {
    'iss': os.getenv('SLIKE_SECRET_TEAMID'),
    'sub': os.getenv('SLIKE_SECRET_SERVICEID'),
    'iat': now.timestamp(),
    'exp': exp.timestamp()
  }
  secret = base64.b64decode(os.getenv('SLIKE_SECRET_P8KEY')).decode("ascii")
  bearer = jwt.encode(protected, payload, secret)
  app.ctx.bearer_exp = exp.timestamp()
  app.ctx.bearer = bearer
  logger.debug("new token signed")

  return bearer

if __name__ == '__main__':
  app.run(host='0.0.0.0', port=8000, debug=os.getenv('SLIKE_DEBUG_ENABLED') == "TRUE")
