"""
crawlers_to_minio_icrawler.py
--------------------------------------------------------------------
Scrape Google Images with `icrawler` and upload the results to MinIO.
Now accepts CLI flags:
  --query        "cat wearing sunglasses"
  --num-image    100
  --prefix       "dataset/cats/"
"""

import os, tempfile, urllib.parse, argparse
from pathlib import Path
from typing import List
from tqdm import tqdm
from icrawler.builtin import GoogleImageCrawler
from minio import Minio

from dotenv import load_dotenv
load_dotenv()

def prepare_minio(endpoint_raw: str,
                  access_key: str,
                  secret_key: str) -> Minio:
    """
    Build a Minio client, defaulting to HTTP unless the scheme is explicitly https://
    """
    if "://" not in endpoint_raw:
        endpoint_raw = "http://" + endpoint_raw  # assume HTTP
    parsed  = urllib.parse.urlparse(endpoint_raw)
    endpoint = parsed.netloc
    secure   = parsed.scheme == "https"
    return Minio(endpoint, access_key, secret_key, secure=secure)

MINIO_CLIENT = prepare_minio(
    os.getenv("MINIO_ENDPOINT", "localhost:9000"),
    os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
    os.getenv("MINIO_SECRET_KEY", "minioadmin"),
)

BUCKET = os.getenv("MINIO_BUCKET", "images")

def ensure_bucket(bucket: str = BUCKET):
    if not MINIO_CLIENT.bucket_exists(bucket):
        MINIO_CLIENT.make_bucket(bucket)


def crawl_google_images(query: str,
                        n_imgs: int,
                        save_dir: Path | None = None,
                        filters: dict | None = None) -> List[Path]:
    """
    Scrape `n_imgs` Google Images results for `query` using icrawler.
    Returns list of downloaded file paths.
    """
    save_dir = Path(save_dir or tempfile.mkdtemp(prefix="icrawl_"))
    GoogleImageCrawler(storage={"root_dir": str(save_dir)}).crawl(
        keyword=query,
        max_num=n_imgs,
        filters=filters or {}
    )
    return list(save_dir.iterdir())


def upload_files_to_minio(files: List[Path],
                          bucket: str = BUCKET,
                          prefix: str = "") -> None:
    ensure_bucket(bucket)
    for p in tqdm(files, desc="Uploading to MinIO"):
        MINIO_CLIENT.fput_object(bucket, f"{prefix}{p.name}", str(p))

def main():
    parser = argparse.ArgumentParser(
        description="Scrape Google Images with icrawler and push to MinIO"
    )
    parser.add_argument("--query", required=True,
                        help="Search keywords for Google Images")
    parser.add_argument("--num-image", "-n", type=int, default=50,
                        help="Number of images to download (default: 50)")
    parser.add_argument("--prefix", default="",
                        help="Object prefix inside the MinIO bucket (e.g. 'cats/')")
    args = parser.parse_args()

    # 1) crawl
    imgs = crawl_google_images(args.query, args.num_image)

    # 2) upload
    upload_files_to_minio(imgs, prefix=args.prefix)

    # 3) clean local cache
    for p in imgs:
        p.unlink(missing_ok=True)

    print(f"\nDone! Uploaded {len(imgs)} files to bucket '{BUCKET}/{args.prefix}'")

if __name__ == "__main__":
    main()