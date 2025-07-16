export MINIO_ENDPOINT="http://0.0.0.0:9000"
export MINIO_ACCESS_KEY="dx1d5kIiRdEopuDc59nf"
export MINIO_SECRET_KEY="3Z7z3wr6El87aX693xSTluQ2T8XCMzDHy7qKW0dd"
export MINIO_BUCKET="ivadatasets"

python crawler.py \
       --query "cat and dogs" \
       --num-image 10 \
       --prefix "dogsandcats/"