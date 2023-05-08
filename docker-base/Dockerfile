FROM sanicframework/sanic:3.11-latest

RUN apk update
RUN apk add build-base gfortran openblas-dev python3-dev
RUN pip install numpy
RUN pip install scipy
RUN apk del build-base gfortran python3-dev