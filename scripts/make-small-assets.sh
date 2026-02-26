#!/bin/zsh
# Simple script to create smaller copies of images under public/assets/photography
# into public/assets/small_assets/photography preserving subdirectories.
# Requires macOS `sips` utility (built-in) or imagemagick (`convert`).
# Usage: cd /Users/shantanu/Documents/portfolio-website/sbs-media && ./scripts/make-small-assets.sh

set -e

SRC_DIR="public/assets/photography"
DST_DIR1="public/assets/small_assets/photography"
DST_DIR2="public/small_assets/photography"

mkdir -p "$DST_DIR1"
mkdir -p "$DST_DIR2"

find "$SRC_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.avif' \) | while read -r file; do
  relpath="${file#$SRC_DIR/}"
  outpath1="$DST_DIR1/$relpath"
  outpath2="$DST_DIR2/$relpath"
  outdir1=$(dirname "$outpath1")
  outdir2=$(dirname "$outpath2")
  mkdir -p "$outdir1" "$outdir2"
  # scale to max width 800px (change as needed)
  if sips --resampleWidth 800 "$file" --out "$outpath1" >/dev/null 2>&1; then
    cp "$outpath1" "$outpath2"
    echo "resized $file -> $outpath1"
  elif convert "$file" -resize 800x "$outpath1" 2>/dev/null; then
    cp "$outpath1" "$outpath2"
    echo "resized $file -> $outpath1"
  else
    # couldn't resize (e.g. unsupported format like webp); just copy original
    cp "$file" "$outpath1" 2>/dev/null || true
    cp "$file" "$outpath2" 2>/dev/null || true
    echo "copied original for $file (resize not supported)"
  fi
  echo "created $outpath1 and $outpath2"
done

echo "Done generating small assets."
