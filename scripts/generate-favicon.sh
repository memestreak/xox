#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
OUT="$ROOT/src/app"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Generate a rounded-rect favicon at a given size
generate() {
  local size=$1 output=$2 pointsize=$3 kerning=$4
  local r=$((size / 8))

  magick -size "${size}x${size}" xc:'#0a0a0a' \
    -font "$FONT" -pointsize "$pointsize" \
    -fill white -gravity center \
    -kerning "$kerning" -annotate 0 "xox" \
    \( +clone -alpha extract \
       -draw "roundrectangle 0,0,$((size-1)),$((size-1)),$r,$r" \) \
    -alpha off -compose CopyOpacity -composite \
    "$output"
}

# Render 16x16 and 32x32 PNGs, combine into ICO
generate 16 /tmp/fav-16.png 10 -1
generate 32 /tmp/fav-32.png 20 -1
magick /tmp/fav-16.png /tmp/fav-32.png "$OUT/favicon.ico"

# Render apple-touch-icon (no rounded corners needed —
# iOS applies its own mask)
magick -size 180x180 xc:'#0a0a0a' \
  -font "$FONT" -pointsize 88 \
  -fill white -gravity center \
  -kerning -2 -annotate 0 "xox" \
  -colorspace sRGB -type TrueColor -depth 8 \
  "$OUT/apple-touch-icon.png"

echo "Generated:"
echo "  $OUT/favicon.ico (16x16 + 32x32)"
echo "  $OUT/apple-touch-icon.png (180x180)"
