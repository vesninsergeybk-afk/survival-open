#!/usr/bin/env bash
# Fetch only CC BY 4.0 tracks from Scott Buckley's official library.
# One-time asset vendoring; sources and license are in assets/audio/music/CREDITS.md.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
command -v curl >/dev/null
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
mkdir -p assets/audio/music
music_tmp="$(mktemp -d)"
trap 'test ! -d "$music_tmp" || rm -r -- "$music_tmp"' EXIT
while IFS='|' read -r name source; do
  [[ -n "$name" ]] || continue
  output="assets/audio/music/${name}.ogg"
  if [[ -s "$output" ]]; then
    echo "Already installed: $output"
    continue
  fi
  echo "Downloading CC BY music: $name"
  curl --fail --location --silent --show-error --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 240 --proto '=https' --proto-redir '=https' "$source" -o "$music_tmp/$name.mp3"
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "$music_tmp/$name.mp3" | grep -q 'duration='
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$music_tmp/$name.mp3" -vn -c:a libopus -b:a 96k -ar 48000 -ac 2 "$output"
  test -s "$output"
  ffprobe -v error -show_entries stream=codec_name -of default=noprint_wrappers=1 "$output" | grep -q 'codec_name=opus'
  echo "Encoded $output: $(du -h "$output" | cut -f1)"
  sleep 1
done <<'TRACKS'
aphelion|https://www.scottbuckley.com.au/library/wp-content/uploads/2026/04/Aphelion.mp3
decoherence|https://www.scottbuckley.com.au/library/wp-content/uploads/2022/03/sb_decoherence.mp3
shadows-and-dust|https://www.scottbuckley.com.au/library/wp-content/uploads/2023/11/ShadowsAndDust.mp3
meanwhile|https://www.scottbuckley.com.au/library/wp-content/uploads/2025/01/Meanwhile.mp3
nightfall|https://www.scottbuckley.com.au/library/wp-content/uploads/2019/05/sb_nightfall.mp3
convergence|https://www.scottbuckley.com.au/library/wp-content/uploads/2026/04/Convergence.mp3
simulacra|https://www.scottbuckley.com.au/library/wp-content/uploads/2025/03/Simulacra.mp3
red|https://www.scottbuckley.com.au/library/wp-content/uploads/2018/10/sb_red.mp3
ambush|https://www.scottbuckley.com.au/wp-content/audio/sb_ambush.mp3
TRACKS

# An input line must never be consumed by the audio converter.
for expected in aphelion decoherence shadows-and-dust meanwhile nightfall convergence simulacra red ambush; do
  test -s "assets/audio/music/${expected}.ogg" || { echo "Missing imported music: $expected" >&2; exit 1; }
done
