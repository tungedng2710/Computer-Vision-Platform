export MLFLOW_S3_ENDPOINT_URL=http://localhost:9000
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AWS_DEFAULT_REGION=vn-north-1

mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/mlflow

mlflow server \
  --backend-store-uri postgresql://mlflowuser:mlflowpass@localhost:5432/mlflowdb \
  --default-artifact-root s3://mlflow/ \
  --host 0.0.0.0 \
  --port 7863