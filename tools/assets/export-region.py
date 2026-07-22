"""Export one generated landscape to the IRPG-406 region contract."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


REGION_SIZE = (1600, 900)
MAX_BYTES = 350 * 1024


def export_region(source: Path, destination: Path) -> tuple[int, int]:
    with Image.open(source) as image:
        landscape = ImageOps.fit(
            image.convert("RGB"),
            REGION_SIZE,
            Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        destination.parent.mkdir(parents=True, exist_ok=True)
        for quality in range(84, 59, -2):
            landscape.save(destination, "WEBP", quality=quality, method=6)
            size = destination.stat().st_size
            if size <= MAX_BYTES:
                return quality, size
    raise RuntimeError(f"could not export {source} within {MAX_BYTES} bytes")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    quality, size = export_region(
        args.source.resolve(strict=True),
        args.destination.resolve(),
    )
    print(f"quality={quality} bytes={size}")


if __name__ == "__main__":
    main()
