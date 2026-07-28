import json
from pathlib import Path

import numpy as np
from PIL import Image

from process_sprites import (
    remove_white_background,
    remove_solid_background,
    register_to_canvas,
    apply_shadow_mask,
    compute_duration_ms,
    REG_CANVAS,
    REG_CENTER_X,
    REG_TARGET_HEIGHT,
    REG_FEET_Y,
)


def test_register_to_canvas_centers_scales_and_adds_shadow():
    # An off-centre, oddly sized subject block on a transparent 256-max frame so
    # the "idle" target height applies predictably.
    arr = np.zeros((256, 256, 4), dtype=np.uint8)
    arr[20:240, 40:120, :3] = (200, 150, 100)  # 80x220 block, left of centre
    arr[20:240, 40:120, 3] = 255
    frame = Image.fromarray(arr, mode="RGBA")

    out = register_to_canvas([frame, frame], "idle")

    assert len(out) == 2
    assert out[0].size == REG_CANVAS
    a = np.array(out[0])
    opaque = a[:, :, 3] > 16
    ys, xs = np.where(opaque)
    # Horizontally centred on the shared anchor (allow a couple px for the shadow blur).
    assert abs((xs.min() + xs.max()) // 2 - REG_CENTER_X) <= 3
    # Subject scaled to idle's explicit target height. Measure the fully-opaque
    # centre column (alpha 255); the soft shadow is semi-transparent (<=110) so
    # a high threshold isolates the subject from the shadow tail below it.
    col = np.where(a[:, REG_CENTER_X, 3] > 200)[0]
    assert abs((col.max() - col.min() + 1) - REG_TARGET_HEIGHT["idle"]) <= 4
    # A ground shadow exists on the baseline row, wider than a bit of noise.
    shadow_row = np.where(a[REG_FEET_Y, :, 3] > 16)[0]
    assert len(shadow_row) > 20


def test_apply_shadow_mask_erases_painted_pixels_only():
    # A fully opaque frame; the mask paints a rectangle to erase.
    arr = np.full((40, 40, 4), 255, dtype=np.uint8)
    frame = Image.fromarray(arr, mode="RGBA")
    cut = np.zeros((40, 40), dtype=bool)
    cut[30:38, 5:35] = True  # painted "shadow" band

    out = np.array(apply_shadow_mask(frame, cut))

    assert out[34, 20, 3] == 0  # painted pixel erased
    assert out[10, 20, 3] == 255  # unpainted pixel untouched


def test_remove_solid_background_clears_border_and_keeps_interior():
    # 20x20 dark background with a lighter subject block in the middle that
    # itself contains one dark (background-coloured) pixel.
    bg = (47, 45, 53)
    arr = np.zeros((20, 20, 4), dtype=np.uint8)
    arr[:, :, :3] = bg
    arr[:, :, 3] = 255
    arr[6:14, 6:14, :3] = (220, 180, 120)  # subject
    arr[10, 10, :3] = bg  # interior pixel that matches the background colour
    frame = Image.fromarray(arr, mode="RGBA")

    result = np.array(remove_solid_background(frame))

    assert result[0, 0, 3] == 0  # border background becomes transparent
    assert result[9, 9, 3] > 0  # subject stays opaque
    assert result[10, 10, 3] > 0  # interior background-coloured pixel is preserved


def test_remove_white_background_clears_white_and_keeps_color():
    arr = np.array(
        [[[255, 255, 255, 255], [0, 0, 0, 255]]], dtype=np.uint8
    )
    frame = Image.fromarray(arr, mode="RGBA")

    result = remove_white_background(frame)

    result_arr = np.array(result)
    assert result_arr[0, 0, 3] < 10  # white pixel becomes transparent
    assert result_arr[0, 1, 3] == 255  # black pixel stays opaque


def test_compute_duration_ms_sums_frame_durations(tmp_path):
    frame_a = Image.new("RGBA", (2, 2), (255, 0, 0, 255))
    frame_b = Image.new("RGBA", (2, 2), (0, 255, 0, 255))
    gif_path = tmp_path / "sample.gif"
    frame_a.save(
        gif_path, save_all=True, append_images=[frame_b], duration=[30, 50], loop=0
    )

    reopened = Image.open(gif_path)

    assert compute_duration_ms(reopened) == 80
