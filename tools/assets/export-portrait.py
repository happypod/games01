"""Export one generated portrait to the IRPG-406 production contract."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


PORTRAIT_SIZE = (768, 768)
BACKGROUND = (18, 16, 15)


def export_portrait(source: Path, destination: Path, safe_scale: float) -> None:
    with Image.open(source) as image:
        rgb = image.convert("RGB")
        safe_size = (
            round(PORTRAIT_SIZE[0] * safe_scale),
            round(PORTRAIT_SIZE[1] * safe_scale),
        )
        fitted = ImageOps.contain(rgb, safe_size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", PORTRAIT_SIZE, BACKGROUND)
        offset = (
            (PORTRAIT_SIZE[0] - fitted.width) // 2,
            (PORTRAIT_SIZE[1] - fitted.height) // 2,
        )
        canvas.paste(fitted, offset)
        destination.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(destination, "WEBP", quality=82, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--safe-scale", type=float, default=1.0)
    args = parser.parse_args()
    if not 0 < args.safe_scale <= 1:
        parser.error("--safe-scale must be greater than 0 and at most 1")
    export_portrait(
        args.source.resolve(strict=True),
        args.destination.resolve(),
        args.safe_scale,
    )


if __name__ == "__main__":
    main()
