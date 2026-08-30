#!/usr/bin/env python3
"""Prepare Inspiration uploads for a sharp, lightweight web gallery."""

from __future__ import annotations

import argparse
import io
import re
from pathlib import Path

from PIL import Image, ImageCms, ImageOps


SITE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = SITE_DIR / "images" / "inspiration" / "uploads"
OUTPUT_DIR = SITE_DIR / "images" / "inspiration"
CONTENT_PATH = SITE_DIR / "content" / "inspiration.md"
MAX_BYTES = 950 * 1024
FORMATS = {
    "portrait": {"ratio": (3, 4), "size": (1500, 2000)},
    "landscape": {"ratio": (3, 2), "size": (2400, 1600)},
}
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value or "inspiration-image"


def display_name(value: str) -> str:
    return re.sub(r"[-_]+", " ", value).strip().title()


def convert_to_srgb(image: Image.Image) -> Image.Image:
    profile = image.info.get("icc_profile")
    if profile:
        try:
            return ImageCms.profileToProfile(
                image,
                io.BytesIO(profile),
                ImageCms.createProfile("sRGB"),
                outputMode="RGB",
            )
        except (ImageCms.PyCMSError, OSError, ValueError):
            pass
    if image.mode in {"RGBA", "LA"}:
        background = Image.new("RGB", image.size, "#f2f0ea")
        alpha = image.getchannel("A")
        background.paste(image.convert("RGB"), mask=alpha)
        return background
    return image.convert("RGB")


def crop_to_ratio(image: Image.Image, ratio: tuple[int, int]) -> Image.Image:
    target_ratio = ratio[0] / ratio[1]
    current_ratio = image.width / image.height
    if current_ratio > target_ratio:
        width = round(image.height * target_ratio)
        left = (image.width - width) // 2
        return image.crop((left, 0, left + width, image.height))
    height = round(image.width / target_ratio)
    top = (image.height - height) // 2
    return image.crop((0, top, image.width, top + height))


def resize_for_display(image: Image.Image, target: tuple[int, int]) -> Image.Image:
    scale = min(1, target[0] / image.width, target[1] / image.height)
    if scale == 1:
        return image
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def encode_under_limit(image: Image.Image) -> tuple[bytes, int, Image.Image]:
    current = image
    while True:
        for quality in range(86, 49, -4):
            buffer = io.BytesIO()
            current.save(buffer, "WEBP", quality=quality, method=6, optimize=True)
            data = buffer.getvalue()
            if len(data) <= MAX_BYTES:
                return data, quality, current
        if current.width <= 900 or current.height <= 600:
            raise RuntimeError("Could not reduce this image below 950 KB without excessive quality loss.")
        current = current.resize(
            (round(current.width * 0.9), round(current.height * 0.9)),
            Image.Resampling.LANCZOS,
        )


def add_to_content(format_name: str, relative_path: str, alt: str) -> None:
    source = CONTENT_PATH.read_text(encoding="utf-8")
    if f"]({relative_path})" in source:
        return
    heading = "Portrait" if format_name == "portrait" else "Landscape"
    marker = f"## {heading}"
    line = f"![{alt}]({relative_path})"
    start = source.index(marker) + len(marker)
    next_heading = source.find("\n## ", start)
    end = next_heading if next_heading != -1 else len(source)
    section = source[start:end].rstrip()
    replacement = f"\n\n{line}\n" if not section else f"{section}\n\n{line}\n"
    source = source[:start] + replacement + source[end:]
    CONTENT_PATH.write_text(source.rstrip() + "\n", encoding="utf-8")


def optimize_file(source: Path, format_name: str) -> None:
    settings = FORMATS[format_name]
    output_folder = OUTPUT_DIR / format_name
    output_folder.mkdir(parents=True, exist_ok=True)
    output = output_folder / f"{slugify(source.stem)}.webp"

    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        image = convert_to_srgb(image)
        image = crop_to_ratio(image, settings["ratio"])
        image = resize_for_display(image, settings["size"])
        data, quality, final_image = encode_under_limit(image)

    output.write_bytes(data)
    relative_path = output.relative_to(SITE_DIR).as_posix()
    add_to_content(format_name, relative_path, display_name(source.stem))
    print(
        f"{format_name.title()}: {source.name} -> {output.name} "
        f"({final_image.width}x{final_image.height}, {len(data) / 1024:.0f} KB, quality {quality})"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Only verify existing gallery outputs.")
    args = parser.parse_args()

    if args.check:
        failures = []
        for format_name in FORMATS:
            for image in (OUTPUT_DIR / format_name).glob("*.webp"):
                if image.stat().st_size > MAX_BYTES:
                    failures.append(image)
        if failures:
            raise SystemExit("Oversized Inspiration images:\n" + "\n".join(str(path) for path in failures))
        print("All Inspiration images are below 950 KB.")
        return

    processed = 0
    for format_name in FORMATS:
        folder = UPLOAD_DIR / format_name
        folder.mkdir(parents=True, exist_ok=True)
        for source in sorted(folder.iterdir()):
            if source.is_file() and source.suffix.lower() in SUPPORTED_EXTENSIONS:
                optimize_file(source, format_name)
                processed += 1
    if not processed:
        print("No new Inspiration uploads found.")


if __name__ == "__main__":
    main()
