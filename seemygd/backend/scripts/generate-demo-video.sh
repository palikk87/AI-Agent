#!/bin/bash
set -e

SRC="/home/user/workspace/webapp/public/og-garage.png"
OUT="/home/user/workspace/webapp/public/demo.mp4"
TMPDIR="/tmp/ogframes"
mkdir -p "$TMPDIR"

W=1200
H=630

echo "Step 1: Generate frames..."

# Frame A: left half (BEFORE) scaled to full 1200x630
ffmpeg -y -i "$SRC" \
  -vf "crop=${W}/2:${H}:0:0,scale=${W}:${H}" \
  "$TMPDIR/before.png" 2>/dev/null

# Frame B: full split image (already 1200x630)
cp "$SRC" "$TMPDIR/split.png"

echo "Step 2: Build video segments..."

# Segment 1: before frame, 3.5s with slow rightward pan (Ken Burns)
ffmpeg -y -loop 1 -t 3.5 -i "$TMPDIR/before.png" \
  -vf "scale=${W}:${H},zoompan=z='1.08':x='iw*(on/105)*0.05':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30,setsar=1,format=yuv420p" \
  -c:v libx264 -preset fast -crf 26 -t 3.5 \
  "$TMPDIR/seg1.mp4" 2>/dev/null

# Segment 2: split image, 6s, gentle zoom out
ffmpeg -y -loop 1 -t 6 -i "$TMPDIR/split.png" \
  -vf "scale=${W}:${H},zoompan=z='1.05-0.0008*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30,setsar=1,format=yuv420p" \
  -c:v libx264 -preset fast -crf 26 -t 6 \
  "$TMPDIR/seg2.mp4" 2>/dev/null

echo "Step 3: Combine with crossfade..."

# Combine with a 0.8s crossfade
ffmpeg -y \
  -i "$TMPDIR/seg1.mp4" \
  -i "$TMPDIR/seg2.mp4" \
  -filter_complex "[0:v][1:v]xfade=transition=wipeleft:duration=0.8:offset=2.7,format=yuv420p[v]" \
  -map "[v]" \
  -c:v libx264 -preset medium -crf 24 -movflags +faststart \
  "$OUT"

SIZE=$(du -k "$OUT" | cut -f1)
echo "Done: $OUT (${SIZE}KB)"
rm -rf "$TMPDIR"
