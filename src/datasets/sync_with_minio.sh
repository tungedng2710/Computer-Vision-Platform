DATASET_DIR="mobile_phone_v1.2"
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mirror --overwrite $DATASET_DIR/ local/ivadatasets/$DATASET_DIR

# For pulling datasets:
# mc mirror --overwrite local/ivadatasets/$DATASET_DIR $DATASET_DIR/

# Update data.yaml files with absolute paths
for yaml_file in $(find $DATASET_DIR -name "data.yaml"); do
  sed -i "s|train: |train: $(pwd)/|" $yaml_file
  sed -i "s|val: |val: $(pwd)/|" $yaml_file
  sed -i "s|test: |test: $(pwd)/|" $yaml_file
done