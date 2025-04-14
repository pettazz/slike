import asyncio
import base64
import json as JSON
import os
import socket
import tracemalloc
from datetime import datetime, timedelta

import httpx
from httpx import ReadTimeout
from httpx._exceptions import HTTPStatusError
import pytz
import redis.asyncio as redis
import reverse_geocode
from authlib.jose import jwt
from cache import AsyncTTL, AsyncLRU
from methodtools import lru_cache
from sanic import Sanic
from sanic.exceptions import SanicException
from sanic.log import logger
from sanic.response import json, file, text

from config import Config

# tracemalloc.start()

app = Sanic('slike')

app.static("/assets/", "web/assets/")

@app.before_server_start
async def bootstrapScoring(app):
  await checkKV(None)
  with open(Config().scoring_location, 'rb') as f:
    scoring_data = f.read()
  await setScorer('default', scoring_data)

@app.on_request
async def checkKV(request):
  if request and request.name in ['slike.hello']:
    logger.debug('skipping kv check for %s' % request.name)
    return
  else:
    if request:
      logger.debug('doing kv check for %s' % request.name)

  if (hasattr(app.ctx, 'kv_time') 
      and datetime.now().timestamp() - app.ctx.kv_time < Config().redis.reconnect_timer
      and hasattr(app.ctx, 'kv')):
    try:
      logger.debug('testing redis connection with ping')
      await app.ctx.kv.ping()
      logger.debug('pong')
    except Exception as e:
      logger.debug('cant connect to redis with existing conn:')
      logger.debug(e)
      app.ctx.kv = await connectKV()
  else:
    app.ctx.kv = await connectKV()

@app.get('/')
async def hello(request):
  return await file('web/index.html')

@app.get('/profiles')
async def profiles(request):
  profiles = []
  cursor = '0'
  cache_ns = 'scoring:*'
  while cursor != 0:
    cursor, keys = await app.ctx.kv.scan(cursor=cursor, match=cache_ns, count=5000)
    if keys:
      profiles.extend([key.decode('utf-8') for key in keys])

  return json(profiles)

@app.get('/forecast')
async def forecast(request):
  lang = request.args.get('lang')
  tz = request.args.get('tz')
  lat = request.args.get('lat')
  lon = request.args.get('lon')
  profile = request.args.get('profile')
  # TODO: check for missing args

  if not profile:
    profile = 'default'

  logger.debug("coords requested (%s, %s)" % (lat, lon))

  if Config().geocache.enabled:
    lat = ('%.' + str(Config().geocache.latlng_decimals) + 'f') % float(lat)
    lon = ('%.' + str(Config().geocache.latlng_decimals) + 'f') % float(lon)
    logger.debug("coords rounded to (%s, %s)" % (lat, lon))

  local, country = revGeo(lat, lon)

  if Config().geocache.enabled:
    data = await cacheableGetForecast(lat, lon, lang, country, tz)
  else:
    data = await getForecast(lat, lon, lang, country, tz)

  fetch_timestamp = data['fetchedAt']
  forecast = data['forecast']

  last_scoring_update = await app.ctx.kv.get('ingest:scoring:%s' % profile)
  scored_results = await doScoring(forecast, profile, last_scoring_update)

  result = {
    'meta': {
      'country': country,
      'local': local
    },
    'forecastFetchTime': fetch_timestamp,
    'forecast': scored_results
  }

  logmem('forecast')
  
  return json(result)

@app.put('/ingest/scoring/<profile>')
async def ingest(request, profile):
  new_data = request.body
  # TODO: validate jsonschema?
  await setScorer(profile, new_data)
  return text('OK')

@app.post('/cache/wipe')
async def cacheWipe(request):
  # TODO: definitely get rid of this after dev
  if not (cache_ns := request.args.get('pattern')): cache_ns = 'cache:*'
  logger.debug('wiping pattern `%s` from kv' % cache_ns)
  cursor = '0'
  while cursor != 0:
    cursor, keys = await app.ctx.kv.scan(cursor=cursor, match=cache_ns, count=5000)
    if keys:
      await app.ctx.kv.delete(*keys)

  return text('OK')
  
async def connectKV():
  logger.debug('opening new redis connection')
  app.ctx.kv_time = datetime.now().timestamp()
  return await redis.Redis(
    host=os.getenv('SLIKE_SECRET_REDIS_HOST'),
    password=os.getenv('SLIKE_SECRET_REDIS_PASSWORD'),
    port=Config().redis.port, 
    decode_responses=False,
    health_check_interval=5,
    socket_keepalive=False,
    socket_connect_timeout=5,
    retry_on_timeout=True
  )

async def setScorer(name, new_data):
  logger.debug('setting scoring data for %s in kv' % name)
  await app.ctx.kv.set('scoring:%s' % name, new_data)
  ts = datetime.now().timestamp()
  await app.ctx.kv.set('ingest:scoring:%s' % name, ts)
  logger.debug('set at %s' % ts)

@AsyncLRU(maxsize=Config().memory_caching.maxsize)
async def getScorer(name, buster):
  logger.debug('loading scoring data for %s from kv' % name)
  return await app.ctx.kv.get('scoring:%s' % name)

async def cacheableGetForecast(lat, lon, lang, country, tz):
  cache_key = "cache:forecast:%s%s%s%s%s" % (lat, lon, lang, country, tz)
  logger.debug("forecast cache key: %s" % cache_key)
  logger.debug("getting cached forecast at %s" % datetime.now().timestamp())
  cached_result = await app.ctx.kv.get(cache_key)
  logger.debug("finished get cached forecast at %s" % datetime.now().timestamp())
  if cached_result is not None:
    logger.debug("using cached forecast")
    result = JSON.loads(cached_result)
  else:
    logger.debug("cache miss, getting new forecast")
    result = await getForecast(lat, lon, lang, country, tz)
    next_hour_ttl = ((datetime.now() + timedelta(hours=1)).replace(microsecond=0, second=0, minute=0) - datetime.now()).seconds
    if next_hour_ttl < 1:
      # in case we are actually within the last second of the hour
      next_hour_ttl = 1
    await app.ctx.kv.set(cache_key, JSON.dumps(result), ex=next_hour_ttl)

  return result

async def getForecast(lat, lon, lang, country, tz):
  logger.debug("getting forecast")
  bearer = checkToken()
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

  return {"fetchedAt": datetime.now(pytz.timezone(tz)).isoformat(), "forecast": r.json()}

@AsyncLRU(maxsize=Config().memory_caching.maxsize)
async def doScoring(forecast_data, profile, buster):
  logger.debug('doing a new scoring')
  scoring_data = await getScorer(profile, buster)
  forecast = []

  for h, hour in enumerate(forecast_data['forecastHourly']['hours']):
    row = {}
    hour_total = 0

    row['time'] = hour['forecastStart']

    for scorer in JSON.loads(scoring_data):
      val = raw_val = hour[scorer['name']]
      if scorer['translation']:
        # TODO: try for missing enum here
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

  logmem('doScoring')
  return forecast

@lru_cache(maxsize=Config().memory_caching.maxsize)
def revGeo(lat, lon):
  logmem('pre-geo')
  coords = reverse_geocode.search([(lat, lon)])
  logmem('post-geo')

  country =coords[0]['country_code']
  local = coords[0]['city']
  logger.debug("revgeo'd to %s, %s" % (local, country))

  return (local, country)

def func(name, val):
  match name:
    case 'exp':
      retval = (0.33 * val) ** 2
    case 'sq':
      retval = val ** 2
    case _:
      retval = val

  return retval

def checkToken():
  if hasattr(app.ctx, 'bearer') and hasattr(app.ctx, 'bearer_exp') and app.ctx.bearer_exp > datetime.now().timestamp():
    logger.debug("reusing token")
    return app.ctx.bearer
  else:
    return newToken()

def newToken():
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

def logmem(location):
  if tracemalloc.is_tracing():
    current, peak = tracemalloc.get_traced_memory()
    logger.debug('memory at `%s` current: %.2f MB, peak: %.2f MB' % (location, current/1024/1024, peak/1024/1024))

if __name__ == '__main__':
  app.run(host='0.0.0.0', port=8000, debug=os.getenv('SLIKE_DEBUG_ENABLED') == "TRUE")
