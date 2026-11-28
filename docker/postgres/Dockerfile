FROM postgis/postgis:18-3.7

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-18-pgvector \
  && rm -rf /var/lib/apt/lists/*