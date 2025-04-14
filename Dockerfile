FROM pettazz/slike-baseimage:1.0

WORKDIR /sanic

COPY server/ .
RUN pip install -r requirements.pip

COPY web/dist/ web

EXPOSE 8000

CMD ["python", "slike.py"]