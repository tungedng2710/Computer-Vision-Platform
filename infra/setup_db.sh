docker run -d \
  --name mlflow-postgres \
  -e POSTGRES_USER=mlflowuser \
  -e POSTGRES_PASSWORD=mlflowpass \
  -e POSTGRES_DB=mlflowdb \
  -p 5432:5432 -p 7862:5432 \
  postgres:latest

docker run -d \
  --name pgadmin \
  -e 'PGADMIN_DEFAULT_EMAIL=admin@admin.com' \
  -e 'PGADMIN_DEFAULT_PASSWORD=admin' \
  -p 5050:80 \
  dpage/pgadmin4