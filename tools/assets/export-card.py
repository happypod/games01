"""Export one generated progression card to the IRPG-406 card contract."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


CARD_SIZE = (512, 512)
BACKGROUND = (18, 16, 15)
MAX_BYTES = 160 * 1024


def export_card(source: Path, destination: Path, safe_scale: float) -> tuple[int, int]:
    with Image.open(source) as image:
        rgb = image.convert("RGB")
        safe_size = (
            round(CARD_SIZE[0] * safe_scale),
            round(CARD_SIZE[1] * safe_scale),
        )
        fitted = ImageOps.contain(rgb, safe_size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", CARD_SIZE, BACKGROUND)
        offset = (
            (CARD_SIZE[0] - fitted.width) // 2,
            (CARD_SIZE[1] - fitted.height) // 2,
        )
        feather = max(8, round(min(fitted.size) * 0.08))
        mask = Image.new("L", fitted.size, 0)
        ImageDraw.Draw(mask).rectangle(
            (feather, feather, fitted.width - feather, fitted.height - feather),
            fill=255,
        )
        mask = mask.filter(ImageFilter.GaussianBlur(radius=feather * 0.72))
        canvas.paste(fitted, offset, mask)

        destination.parent.mkdir(parents=True, exist_ok=True)
        for quality in range(84, 59, -2):
            canvas.save(destination, "WEBP", quality=quality, method=6)
            size = destination.stat().st_size
            if size <= MAX_BYTES:
                return quality, size
    raise RuntimeError(f"could not export {source} within {MAX_BYTES} bytes")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--safe-scale", type=float, default=0.70)
    args = parser.parse_args()
    if not 0 < args.safe_scale <= 1:
        parser.error("--safe-scale must be greater than 0 and at most 1")

    quality, size = export_card(
        args.source.resolve(strict=True),
        args.destination.resolve(),
        args.safe_scale,
    )
    print(f"quality={quality} bytes={size}")


if __name__ == "__main__":
    main()
