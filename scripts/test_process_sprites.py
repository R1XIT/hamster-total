import json
from pathlib import Path

import numpy as np
from PIL import Image

from process_sprites import remove_white_background, compute_duration_ms


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
