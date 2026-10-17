#!/usr/bin/env bash
# Explicit setup only. Runtime workers do not download models or call hosted APIs.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" == Darwin ]]; then
  command -v brew >/dev/null || { echo 'Install Homebrew from brew.sh first.' >&2; exit 1; }
  HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 brew install cmake tesseract
else
  for tool in cmake c++ tesseract curl; do command -v "$tool" >/dev/null || { echo 'Install build-essential cmake curl tesseract-ocr tesseract-ocr-eng on Linux first.' >&2; exit 1; }; done
fi
for tool in ffmpeg ffprobe bun uv python3; do command -v "$tool" >/dev/null || { echo "Missing $tool; install it before setup." >&2; exit 1; }; done
mkdir -p .runtime/models/tessdata fixtures
fetch_verified() {
  local url="$1" destination="$2" expected="$3" limit="$4"
  if [[ ! -f "$destination" ]]; then
    curl -fL --proto '=https' --proto-redir '=https' --connect-timeout 30 --max-filesize "$limit" "$url" -o "$destination.part"
    mv "$destination.part" "$destination"
  fi
  python3 - "$destination" "$expected" <<'PY'
import hashlib,sys
with open(sys.argv[1],'rb') as f:
    h=hashlib.sha256()
    for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    actual=h.hexdigest()
if actual != sys.argv[2]:
    raise SystemExit('Checksum mismatch: remove the downloaded file and retry trusted source')
PY
}
fetch_verified https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.4.tar.gz .runtime/whisper-v1.9.4.tar.gz 57e280cee375ab02425b806ad5146b99f6eb9357e3c2b31357c8a6af2e2e44ae 30000000
if [[ ! -d .runtime/whisper.cpp-1.9.4 ]]; then tar -xzf .runtime/whisper-v1.9.4.tar.gz -C .runtime; fi
cmake -S .runtime/whisper.cpp-1.9.4 -B .runtime/whisper.cpp-1.9.4/build -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_IS_DEV=OFF -DWHISPER_BUILD_TESTS=OFF -DGGML_METAL=OFF -DGGML_BLAS=OFF -DGGML_OPENMP=OFF -DBUILD_SHARED_LIBS=OFF
cmake --build .runtime/whisper.cpp-1.9.4/build --target whisper-cli -j 2
fetch_verified https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin .runtime/models/ggml-base.bin 60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe 200000000
fetch_verified https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata .runtime/models/tessdata/eng.traineddata 7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2 10000000
cp .runtime/whisper.cpp-1.9.4/samples/jfk.wav fixtures/jfk.wav
python3 scripts/install-translation.py
bun scripts/configure-local.ts
echo 'Installed local engines/models. Billing configured FREE. Run bun run demo:ai and bun run test:ai.'
