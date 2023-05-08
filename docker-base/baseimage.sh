#!/usr/bin/env bash

# i really thought this was going to be more complicated

docker build -t pettazz/slike-baseimage:1.0 .
docker push pettazz/slike-baseimage:1.0