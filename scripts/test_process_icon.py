from pathlib import Path

from PIL import Image

from process_icon import build_ico, build_tray_png, resize_square


def test_resize_square_produces_exact_dimensions_and_rgba():
    im = Image.new("RGB", (400, 250), (10, 20, 30))
    result = resize_square(im, 64)
    assert result.size == (64, 64)
    assert result.mode == "RGBA"


def test_build_ico_writes_all_requested_sizes(tmp_path):
    source = tmp_path / "source.jpg"
    Image.new("RGB", (500, 500), (200, 100, 50)).save(source, format="JPEG")
    output = tmp_path / "assets" / "icon.ico"

    build_ico(source, output, sizes=[16, 32, 48])

    assert output.exists()
    reopened = Image.open(output)
    assert set(reopened.info["sizes"]) == {(16, 16), (32, 32), (48, 48)}


def test_build_tray_png_writes_square_png(tmp_path):
    source = tmp_path / "source.jpg"
    Image.new("RGB", (500, 500), (200, 100, 50)).save(source, format="JPEG")
    output = tmp_path / "assets" / "tray-icon.png"

    build_tray_png(source, output, size=32)

    assert output.exists()
    reopened = Image.open(output)
    assert reopened.size == (32, 32)
    assert reopened.format == "PNG"
