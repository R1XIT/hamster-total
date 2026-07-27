import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageSequence

SPRITE_MAP = {
    "idle": ("sprites/homo_defoult.gif", False, "homo_defoult.webp"),
    "idleVariant1": ("sprites/homo_randomAnim1.gif", True, "homo_randomAnim1.webp"),
    "idleVariant2": ("sprites/homo_randomAnim2.gif", True, "homo_randomAnim2.webp"),
    "fallingAsleep": ("sprites/homo_sleep/homo_sleep1.gif", True, "homo_sleep1.webp"),
    "sleeping": ("sprites/homo_sleep/homo_sleep2.gif", True, "homo_sleep2.webp"),
    "waking": ("sprites/homo_sleep/homo_slep3.gif", True, "homo_sleep3.webp"),
    "dragging": ("sprites/homo_drag.gif", True, "homo_drag.webp"),
    "scanning": ("sprites/homo_viruschech.gif", True, "homo_viruschech.webp"),
    "eating": ("sprites/homo_eatsHDD.gif", True, "homo_eatsHDD.webp"),
}

LOOPING_STATES = {"idle", "sleeping", "dragging", "scanning"}


def remove_white_background(frame: Image.Image, threshold: int = 240, feather: int = 20) -> Image.Image:
    rgba = frame.convert("RGBA")
    arr = np.array(rgba).astype(np.float32)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    whiteness = rgb.min(axis=2)
    low = threshold - feather
    fade = np.clip((threshold - whiteness) / max(threshold - low, 1), 0.0, 1.0)
    arr[:, :, 3] = alpha * fade
    return Image.fromarray(arr.astype(np.uint8), mode="RGBA")


def compute_duration_ms(im: Image.Image) -> int:
    total = 0
    for frame in ImageSequence.Iterator(im):
        total += frame.info.get("duration", 100)
    return total


def process_all(project_root: Path) -> None:
    output_dir = project_root / "assets" / "processed"
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {}

    for state, (rel_source, needs_removal, out_name) in SPRITE_MAP.items():
        source_path = project_root / rel_source
        im = Image.open(source_path)
        frames = []
        durations = []
        for frame in ImageSequence.Iterator(im):
            processed = remove_white_background(frame) if needs_removal else frame.convert("RGBA")
            frames.append(processed)
            durations.append(frame.info.get("duration", 100))

        out_path = output_dir / out_name
        frames[0].save(
            out_path,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            disposal=2,
        )

        manifest[state] = {
            "file": out_name,
            "durationMs": sum(durations),
            "loop": state in LOOPING_STATES,
        }

    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(manifest)} sprites and manifest to {manifest_path}")


if __name__ == "__main__":
    process_all(Path(__file__).resolve().parent.parent)
