"""Build the repository-pinned visual-regression font subset.

The source font is intentionally kept outside the deployed tree. Pass the
official Noto Sans KR variable TTF downloaded from Google Fonts as argv[1].
"""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


TEXT_EXTENSIONS = {".css", ".html", ".ts", ".tsx"}
EXTRA_GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ●✦←→–—·×…%+−/()[]{}:;,.!?'’\""


def collect_text(root: Path) -> str:
    candidates = [root / "index.html", *(root / "src").rglob("*")]
    text = [EXTRA_GLYPHS]
    for path in candidates:
        if path.is_file() and path.suffix in TEXT_EXTENSIONS:
            text.append(path.read_text(encoding="utf-8"))
    return "".join(text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()

    root = args.root.resolve(strict=True)
    source = args.source.resolve(strict=True)
    destination = args.destination.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)

    options = subset.Options()
    options.flavor = "woff2"
    options.hinting = False
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    options.name_languages = [0x409]

    font = TTFont(source)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=collect_text(root))
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(destination)


if __name__ == "__main__":
    main()
