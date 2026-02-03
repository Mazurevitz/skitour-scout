#!/bin/bash
# Generate placeholder icons for Tauri
# Requires ImageMagick: brew install imagemagick

ICON_DIR="src-tauri/icons"
mkdir -p "$ICON_DIR"

# Create a simple mountain icon using ImageMagick
# If you have a real icon, replace this with proper icon generation

echo "Generating placeholder icons..."

# Generate a simple blue circle with white mountain as placeholder
convert -size 1024x1024 xc:transparent \
  -fill "#2563eb" -draw "circle 512,512 512,50" \
  -fill "white" -draw "polygon 512,200 800,700 224,700" \
  -fill "#e5e7eb" -draw "polygon 512,200 620,450 512,400 404,450" \
  "$ICON_DIR/icon.png" 2>/dev/null || {
    echo "ImageMagick not available, creating basic placeholder..."
    # Create a simple 1x1 blue PNG as absolute fallback
    printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x00\x05\xfe\xd4\x00\x00\x00\x00IEND\xaeB`\x82' > "$ICON_DIR/icon.png"
}

# Generate different sizes
for size in 32 128 256; do
  if command -v convert &> /dev/null; then
    convert "$ICON_DIR/icon.png" -resize ${size}x${size} "$ICON_DIR/${size}x${size}.png"
  else
    cp "$ICON_DIR/icon.png" "$ICON_DIR/${size}x${size}.png"
  fi
done

# Create @2x version
if command -v convert &> /dev/null; then
  convert "$ICON_DIR/icon.png" -resize 256x256 "$ICON_DIR/128x128@2x.png"
else
  cp "$ICON_DIR/icon.png" "$ICON_DIR/128x128@2x.png"
fi

# Create .icns for macOS (requires iconutil)
if command -v iconutil &> /dev/null && command -v convert &> /dev/null; then
  ICONSET="$ICON_DIR/icon.iconset"
  mkdir -p "$ICONSET"

  for size in 16 32 64 128 256 512; do
    convert "$ICON_DIR/icon.png" -resize ${size}x${size} "$ICONSET/icon_${size}x${size}.png"
    convert "$ICON_DIR/icon.png" -resize $((size*2))x$((size*2)) "$ICONSET/icon_${size}x${size}@2x.png"
  done

  iconutil -c icns "$ICONSET" -o "$ICON_DIR/icon.icns"
  rm -rf "$ICONSET"
else
  echo "Note: iconutil not available, skipping .icns generation"
  # Create empty .icns placeholder
  touch "$ICON_DIR/icon.icns"
fi

# Create .ico for Windows (requires ImageMagick)
if command -v convert &> /dev/null; then
  convert "$ICON_DIR/icon.png" -define icon:auto-resize=256,128,64,48,32,16 "$ICON_DIR/icon.ico"
else
  touch "$ICON_DIR/icon.ico"
fi

echo "Icons generated in $ICON_DIR"
ls -la "$ICON_DIR"
