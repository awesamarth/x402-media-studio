#!/usr/bin/env python3
"""Explicit installation only; runtime translate.py never calls the network."""
import hashlib
import json
import platform
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.runtime/translation'
URL = 'https://argos-net.com/v1/translate-en_es-1_0.argosmodel'
# SHA-256 measured from the complete official registry-linked archive.
SHA256 = 'd698d0ef87ad70d5d184b7fa6965905bf4368f09a2bb9ffb165a79bac96af0c4'


def main():
    BASE.mkdir(parents=True, exist_ok=True)
    python = BASE / 'venv/bin/python'
    if not python.exists():
        subprocess.run(['uv', 'venv', '--python', '3.12', str(BASE / 'venv')], check=True)
    lock = ROOT / ('runtime/translation/requirements-macos-arm64.lock'
                   if platform.system() == 'Darwin' else 'runtime/translation/requirements-linux-arm64.lock')
    subprocess.run(['uv', 'pip', 'sync', '--require-hashes', '--python', str(python), str(lock)], check=True)
    archive = BASE / 'downloads/translate-en_es-1_0.argosmodel'
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        temporary = archive.with_suffix('.part')
        subprocess.run(['curl', '-fL', '--proto', '=https', '--proto-redir', '=https', '--max-filesize', str(150 * 1024 * 1024),
                        '--connect-timeout', '30', URL, '-o', str(temporary)], check=True)
        temporary.rename(archive)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != SHA256:
        raise ValueError('Model checksum mismatch; remove archive and retry trusted download')
    destination = BASE / 'models'
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as package:
        for entry in package.infolist():
            target = (destination / entry.filename).resolve()
            if not target.is_relative_to(destination.resolve()) or entry.file_size > 300 * 1024 * 1024:
                raise ValueError('Unsafe model archive entry')
        if sum(entry.file_size for entry in package.infolist()) > 400 * 1024 * 1024:
            raise ValueError('Model archive expands beyond bound')
        package.extractall(destination)
    manifest = {'source': URL, 'sha256': digest, 'bytes': archive.stat().st_size,
                'pair': 'en-es', 'package_version': '1.0'}
    files = {str(path.relative_to(destination / 'en_es')): {
        'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()
    } for path in (destination / 'en_es').rglob('*') if path.is_file()}
    (BASE / 'model-files.json').write_text(json.dumps(files, indent=2) + '\n')
    (BASE / 'model-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    versions = subprocess.check_output([str(python), '-c',
        'import importlib.metadata,json; print(json.dumps({name:importlib.metadata.version(name) for name in [\"ctranslate2\",\"sentencepiece\",\"numpy\"]}))'], text=True)
    (destination / 'en_es/runtime-manifest.json').write_text(versions)
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
