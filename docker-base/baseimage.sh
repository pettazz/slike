#!/usr/bin/env bash

# i really thought this was going to be more complicated

docker build --platform=linux/amd64 -t pettazz/slike-baseimage:1.0 .
docker push pettazz/slike-baseimage:1.0