import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageSequence

# Each entry: (source gif, background-removal mode, output webp).
# Modes:
#   "transparent" - gif already has a real alpha channel; keep it as-is.
#   "white"       - subject on a white/near-white matte; fade white to alpha.
#   "solid"       - subject on a solid opaque (e.g. dark) matte; flood-fill the
#                   border-connected background away. Used for homo_defaoult2,
#                   which was exported with a dark background baked in.
SPRITE_MAP = {
    "idle": ("sprites/homo_defaoult2.gif", "solid", "homo_defaoult2.webp"),
    "idleVariant1": ("sprites/homo_randomAnim1.gif", "white", "homo_randomAnim1.webp"),
    "idleVariant2": ("sprites/homo_randomAnim2.gif", "white", "homo_randomAnim2.webp"),
    "fallingAsleep": ("sprites/homo_sleep/homo_sleep1.gif", "white", "homo_sleep1.webp"),
    "sleeping": ("sprites/homo_sleep/homo_sleep2.gif", "white", "homo_sleep2.webp"),
    "waking": ("sprites/homo_sleep/homo_slep3.gif", "white", "homo_sleep3.webp"),
    "dragging": ("sprites/homo_drag.gif", "white", "homo_drag.webp"),
    "scanning": ("sprites/homo_viruschech.gif", "white", "homo_viruschech.webp"),
    "eating": ("sprites/homo_eatsHDD.gif", "white", "homo_eatsHDD.webp"),
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


def _border_connected(near: np.ndarray) -> np.ndarray:
    """Return the subset of `near` (a bool mask) that is connected to any image
    edge, via iterative 4-neighbour propagation seeded from the borders."""
    seed = np.zeros_like(near)
    seed[0, :] |= near[0, :]
    seed[-1, :] |= near[-1, :]
    seed[:, 0] |= near[:, 0]
    seed[:, -1] |= near[:, -1]
    while True:
        grown = seed.copy()
        grown[1:, :] |= seed[:-1, :]
        grown[:-1, :] |= seed[1:, :]
        grown[:, 1:] |= seed[:, :-1]
        grown[:, :-1] |= seed[:, 1:]
        grown &= near
        if grown.sum() == seed.sum():
            return grown
        seed = grown


def remove_solid_background(frame: Image.Image, tol: float = 18.0) -> Image.Image:
    """Strip a solid, opaque background matte from an animation frame.

    Only the background region *connected to the frame edges* is removed, so
    background-coloured pixels inside the subject (e.g. a hamster's dark shading)
    are preserved instead of being punched out — this is what stops the subject
    from being partially erased. The background colour is auto-detected from the
    top-left corner; `tol` is the Euclidean RGB distance treated as "background".

    `tol` is deliberately small: homo_defaoult2's matte is near-perfectly uniform
    (measured noise <=3), while the hamster's darkest edge features (mouth line,
    whiskers, chin shading) sit ~38 away from the matte colour. A low threshold
    therefore removes all background yet keeps those dark edge features — a higher
    threshold (e.g. 48) flood-fills straight through them and eats the mouth/back.
    A median filter removes stray specks (and fills 1px holes) and a light blur
    anti-aliases the cut edge.
    """
    rgba = np.array(frame.convert("RGBA")).astype(np.uint8)
    # int32 so the squared channel differences (up to 255**2) cannot overflow.
    rgb = rgba[:, :, :3].astype(np.int32)
    bg_color = rgb[0, 0]
    near = np.sqrt(((rgb - bg_color) ** 2).sum(axis=2)) < tol
    background = _border_connected(near)
    alpha = np.where(background, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, "L")
    alpha_img = alpha_img.filter(ImageFilter.MedianFilter(3))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.5))
    rgba[:, :, 3] = np.array(alpha_img)
    return Image.fromarray(rgba, "RGBA")


def apply_removal(frame: Image.Image, mode: str) -> Image.Image:
    if mode == "white":
        return remove_white_background(frame)
    if mode == "solid":
        return remove_solid_background(frame)
    return frame.convert("RGBA")


# --- Shadow stripping + registration ---------------------------------------
# Every source animation baked its own inconsistent ground shadow (different
# shape/direction/darkness), and homo_defaoult2 sat at a different size/position
# than the rest with no shadow at all, so switching states made the hamster jump
# and the shadows never matched. To fix both, each sprite is (1) stripped of its
# baked ground shadow and (2) re-laid onto a shared 256x256 canvas — horizontally
# centred, feet on one baseline — then given ONE identical ground shadow. The
# hamster's on-screen size is preserved (the canvas just becomes uniform) except
# for idle, which is resized down to match the other idle poses.
REG_CANVAS = (256, 256)
REG_CENTER_X = 128
REG_FEET_Y = 214
# Explicit on-canvas content height overrides; any state not listed keeps its
# original apparent size (only the canvas is normalised). idle is shrunk to line
# up with the idleVariant poses it swaps with.
REG_TARGET_HEIGHT = {"idle": 204}
# Hand-painted shadow masks (white = erase) live here, one PNG per state, at the
# source sprite's native resolution. They were drawn in the browser masking tool
# and are the authoritative cut — automatic separation failed because the shadow
# shares the hamster belly's grey tone. A state with a mask file gets its baked
# shadow removed by the mask; idle has none.
SHADOW_MASK_DIR = "sprites/shadow_masks"


def load_shadow_masks(project_root: Path) -> dict:
    """Load per-state boolean cut masks (True = erase) keyed by state name."""
    mask_dir = project_root / SHADOW_MASK_DIR
    masks = {}
    if not mask_dir.is_dir():
        return masks
    for path in mask_dir.glob("*.png"):
        masks[path.stem] = np.array(Image.open(path).convert("L")) > 10
    return masks


def apply_shadow_mask(frame: Image.Image, cut: np.ndarray) -> Image.Image:
    """Erase (zero the alpha of) the pixels the user painted over — the baked
    ground shadow. The mask matches the frame's native resolution."""
    arr = np.array(frame)
    arr[cut, 3] = 0
    return Image.fromarray(arr, "RGBA")


def _union_content_bbox(frames):
    left = top = 10 ** 9
    right = bottom = -1
    for frame in frames:
        alpha = np.array(frame)[:, :, 3] > 16
        ys, xs = np.where(alpha)
        if len(xs) == 0:
            continue
        left = min(left, int(xs.min()))
        right = max(right, int(xs.max()))
        top = min(top, int(ys.min()))
        bottom = max(bottom, int(ys.max()))
    return left, top, right, bottom


def _ground_shadow() -> Image.Image:
    """One identical soft ground shadow, shared by every animation so switching
    states never changes the shadow."""
    shadow = Image.new("RGBA", REG_CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    ellipse_w, ellipse_h = 112, 28
    cx, cy = REG_CENTER_X, REG_FEET_Y
    draw.ellipse(
        [cx - ellipse_w // 2, cy - ellipse_h // 2, cx + ellipse_w // 2, cy + ellipse_h // 2],
        fill=(0, 0, 0, 110),
    )
    return shadow.filter(ImageFilter.GaussianBlur(6))


def register_to_canvas(frames, state: str):
    """Re-register frames onto the shared canvas: horizontally centre the hamster,
    plant its feet on the shared baseline, and drop the shared shadow under it.
    One scale/offset is used for the whole clip, so the animation's own motion is
    preserved. On-screen size is preserved unless REG_TARGET_HEIGHT overrides it."""
    left, top, right, bottom = _union_content_bbox(frames)
    union_h = bottom - top + 1
    src_canvas_max = max(frames[0].width, frames[0].height)
    if state in REG_TARGET_HEIGHT:
        target_h = REG_TARGET_HEIGHT[state]
    else:
        # Preserve apparent size: same on-screen height once the canvas is 256.
        target_h = union_h * REG_CANVAS[1] / src_canvas_max
    scale = target_h / union_h
    offset_x = round(REG_CENTER_X - (left + right) / 2 * scale)
    offset_y = round(REG_FEET_Y - (bottom + 1) * scale)
    shadow = _ground_shadow()
    registered = []
    for frame in frames:
        scaled = frame.resize((round(frame.width * scale), round(frame.height * scale)))
        canvas = Image.new("RGBA", REG_CANVAS, (0, 0, 0, 0))
        canvas.alpha_composite(shadow)
        canvas.alpha_composite(scaled, (offset_x, offset_y))
        registered.append(canvas)
    return registered


def compute_duration_ms(im: Image.Image) -> int:
    total = 0
    for frame in ImageSequence.Iterator(im):
        total += frame.info.get("duration", 100)
    return total


def process_all(project_root: Path) -> None:
    output_dir = project_root / "assets" / "processed"
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {}
    shadow_masks = load_shadow_masks(project_root)

    for state, (rel_source, mode, out_name) in SPRITE_MAP.items():
        source_path = project_root / rel_source
        im = Image.open(source_path)
        frames = []
        durations = []
        for frame in ImageSequence.Iterator(im):
            processed = apply_removal(frame, mode)
            frames.append(processed)
            durations.append(frame.info.get("duration", 100))

        if state in shadow_masks:
            cut = shadow_masks[state]
            frames = [apply_shadow_mask(f, cut) for f in frames]
        # Every state is registered onto the shared canvas with the shared shadow,
        # so all animations line up and carry one identical shadow.
        frames = register_to_canvas(frames, state)

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
