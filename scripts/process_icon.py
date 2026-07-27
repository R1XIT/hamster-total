import sys
from pathlib import Path

from PIL import Image

ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
TRAY_ICON_SIZE = 32


def resize_square(im: Image.Image, size: int) -> Image.Image:
    rgba = im.convert("RGBA")
    return rgba.resize((size, size), Image.LANCZOS)


def build_ico(source_path: Path, output_path: Path, sizes: list[int] = ICO_SIZES) -> None:
    im = Image.open(source_path)
    largest = resize_square(im, max(sizes))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    largest.save(output_path, format="ICO", sizes=[(s, s) for s in sizes])


def build_tray_png(source_path: Path, output_path: Path, size: int = TRAY_ICON_SIZE) -> None:
    im = Image.open(source_path)
    resized = resize_square(im, size)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    resized.save(output_path, format="PNG")


def process_all(project_root: Path) -> None:
    source_path = project_root / "icon" / "logo.jpg"
    assets_dir = project_root / "assets"

    build_ico(source_path, assets_dir / "icon.ico")
    build_tray_png(source_path, assets_dir / "tray-icon.png")

    print(f"Wrote {assets_dir / 'icon.ico'} ({len(ICO_SIZES)} sizes) and {assets_dir / 'tray-icon.png'}")


if __name__ == "__main__":
    process_all(Path(__file__).resolve().parent.parent)
    sys.exit(0)
