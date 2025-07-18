#!/usr/bin/env python3
from minio import Minio
from minio.error import S3Error
import subprocess, threading, time, os, sys, signal
from pathlib import Path

DATASET_DIR = "weapons_detection_mini"
MINIO_ENDPOINT = "localhost:9000"
ACCESS_KEY     = "minioadmin"
SECRET_KEY     = "minioadmin"
BUCKET         = "ivadatasets"      # your bucket name
PREFIX         = "weapons_detection_mini/"        # watch only this subfolder
IMAGE_EXTS     = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tif", ".tiff"}

DEBOUNCE_SEC   = 30              # time window to wait before triggering
MIN_IMAGES     = 100             # minimum images before training
TRAIN_CMD      = ["bash", "train.sh"]

client = Minio(MINIO_ENDPOINT, ACCESS_KEY, SECRET_KEY, secure=False)

# --- tracking state
_timer_lock = threading.Lock()
_timer: threading.Timer | None = None
upload_counter = 0


def run(cmd: list[str]) -> None:
    """Run a command, stream its stdout/stderr, and raise on failure."""
    print(f"$ {' '.join(cmd)}")                     # log the command (optional)
    subprocess.run(cmd, check=True)                 # will raise CalledProcessError if bad


def _run_training():
    global upload_counter
    if upload_counter >= MIN_IMAGES:
        print(f"🚀 {upload_counter} images detected - triggering training...")
        try:
            run(["bash", "sync_and_train.sh"])
            # subprocess.run(TRAIN_CMD, check=True)
            print("✅ train_yolo.py finished OK")
        except subprocess.CalledProcessError as e:
            print("❌ train_yolo.py crashed - return code:", e.returncode)
    else:
        print(f"❎ Only {upload_counter} new images - skipping training.")

    upload_counter = 0  # reset counter after debounce window

def _schedule_training():
    global _timer
    with _timer_lock:
        if _timer:
            _timer.cancel()
        _timer = threading.Timer(DEBOUNCE_SEC, _run_training)
        _timer.daemon = True
        _timer.start()
        print(f"⏳ Training check scheduled in {DEBOUNCE_SEC}s")

def is_image(key: str) -> bool:
    return os.path.splitext(key.lower())[1] in IMAGE_EXTS

def watch():
    global upload_counter
    events = ["s3:ObjectCreated:*"]
    print(f"👀 Watching bucket “{BUCKET}” prefix “{PREFIX}” for image upload...")

    try:
        with client.listen_bucket_notification(BUCKET, PREFIX, "", events) as it:
            for note in it:
                for rec in note["Records"]:
                    key = rec["s3"]["object"]["key"]
                    if is_image(key):
                        when = rec["eventTime"]
                        print(f"[{when}] 🖼️  New image uploaded: {key}")
                        upload_counter += 1
                        _schedule_training()
    except S3Error as err:
        print("⚠️  MinIO error:", err)

def shutdown(signum, _frame):
    print("\n👋  Shutting down cleanly...")
    with _timer_lock:
        if _timer: _timer.cancel()
    sys.exit(0)

signal.signal(signal.SIGINT,  shutdown)
signal.signal(signal.SIGTERM, shutdown)

if __name__ == "__main__":
    watch()