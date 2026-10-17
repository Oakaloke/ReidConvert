#!/usr/bin/env bash
# ReidConvert — generate small, legally-safe test fixtures locally.
# Uses tools commonly available on macOS/Linux: sips (macOS), ImageMagick, ffmpeg, python3.
# Nothing copyrighted is downloaded — everything is synthesised here.
set -u
cd "$(dirname "$0")"
mkdir -p fixtures
cd fixtures
echo "Generating fixtures in $(pwd)…"

# --- PNG with transparency (python/Pillow if present, else ImageMagick) ---
if python3 -c "import PIL" 2>/dev/null; then
  python3 - <<'PY'
from PIL import Image, ImageDraw
im = Image.new("RGBA",(240,160),(0,0,0,0))
d = ImageDraw.Draw(im); d.ellipse((20,20,220,140), fill=(1,41,93,255))
im.save("photo.png")
im.convert("RGB").save("photo.jpg", quality=90)
im.convert("RGB").save("photo.webp")
print("png/jpg/webp ok")
PY
elif command -v magick >/dev/null 2>&1; then
  magick -size 240x160 xc:none -fill '#01295D' -draw 'circle 120,80 120,20' photo.png
  magick photo.png photo.jpg
  magick photo.png photo.webp
fi

# --- multi-page PDF (ImageMagick or macOS) ---
if command -v magick >/dev/null 2>&1; then
  magick -size 600x800 xc:white -pointsize 40 -annotate +40+80 'ReidConvert test page one' p1.png
  magick -size 600x800 xc:white -pointsize 40 -annotate +40+80 'Page two with more text'   p2.png
  magick p1.png p2.png digital.pdf
  rm -f p1.png p2.png
fi

# --- short MP4 with audio (ffmpeg) ---
if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -y -f lavfi -i testsrc=duration=3:size=320x240:rate=15 \
         -f lavfi -i sine=frequency=440:duration=3 \
         -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest sample.mp4 >/dev/null 2>&1
  ffmpeg -y -f lavfi -i sine=frequency=440:duration=3 sample.flac >/dev/null 2>&1
  cp sample.mp4 sample.mov 2>/dev/null || ffmpeg -y -i sample.mp4 -c copy sample.mov >/dev/null 2>&1
fi

# --- corrupt + wrong-extension files (every category) ---
printf 'not a real image' > corrupt.png
printf 'not a real pdf'   > corrupt.pdf
cp photo.jpg not-really-png.png 2>/dev/null || true

echo "Done. Created:"; ls -1
echo
echo "NOTE: a real HEIC and a camera RAW (CR2/NEF/ARW/DNG) cannot be synthesised reliably here."
echo "Add your own small samples named sample.heic and sample.dng (record the source + licence)."
