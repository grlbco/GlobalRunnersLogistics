#!/usr/bin/env bash
# Turn the hero clip into scroll frames (docs/plan/03, Scene 1).
# Usage: scripts/make-frames.sh path/to/clip.mp4 [start_seconds] [duration_seconds] [frames]
set -euo pipefail
IN="$1"; START="${2:-0}"; DUR="${3:-6}"; FRAMES="${4:-150}"
OUT="public/frames/truck"
mkdir -p "$OUT/mobile" "$OUT/desktop"
FPS=$(python3 -c "print($FRAMES/$DUR)")
ffmpeg -y -ss "$START" -t "$DUR" -i "$IN" -vf "fps=$FPS,scale=1920:-2" -c:v libwebp -quality 72 "$OUT/desktop/%04d.webp"
ffmpeg -y -ss "$START" -t "$DUR" -i "$IN" -vf "fps=$FPS,scale=720:-2"  -c:v libwebp -quality 68 "$OUT/mobile/%04d.webp"
cp "$OUT/desktop/0001.webp" "$OUT/poster.webp"
echo "Frames: $(ls "$OUT/desktop" | wc -l). Set truckSequence.count in content/media.ts"
du -sh "$OUT/desktop" "$OUT/mobile"
