FROM pettazz/slike-baseimage:1.0

WORKDIR /sanic

COPY . .

RUN pip install -r requirements.pip

EXPOSE 8000

CMD ["python", "slike.py"]