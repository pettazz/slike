#!/usr/bin/env bash

# RUNNING_ID=$(docker ps --no-trunc -aqf name=slike)
# if [ ! -z "$RUNNING_ID" ];then
#   echo "stopping old container..."
#   docker stop $RUNNING_ID
#   docker rm $RUNNING_ID
# fi

# docker build -t slike .

# ENVS="-e SLIKE_DEBUG_ENABLED=TRUE"
# while read -r line
# do
#   key=${line%:*}
#   val=${line#*:}
#   ENVS="$ENVS -e SLIKE_SECRET_$key=\"$val\""
# done < "secrets.config"

# CMD="docker run --name slike -p 80:8000 $ENVS -d slike"
# eval $CMD

docker-compose down
docker build -t slike .

rm .dev-secrets.env
touch .dev-secrets.env

echo "SLIKE_DEBUG_ENABLED=\"TRUE\"" >> .dev-secrets.env
echo "SLIKE_ENV=\"DEV\"" >> .dev-secrets.env
while read -r line
do
  key=${line%:*}
  val=${line#*:}
  echo "SLIKE_SECRET_$key=\"$val\"" >> .dev-secrets.env
done < "secrets.config"
echo "SLIKE_REDIS_HOST=\"redis\"" >> .dev-secrets.env
echo "SLIKE_REDIS_PASSWORD=\"\"" >> .dev-secrets.env

docker-compose up