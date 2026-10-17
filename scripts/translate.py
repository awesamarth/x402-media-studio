#!/usr/bin/env python3
"""Offline cue translation using the explicitly installed Argos en→es model."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = ROOT / '.runtime/translation/models/en_es'


def main():
    raw = sys.stdin.buffer.read(262145)
    if len(raw) > 262144:
        raise ValueError('Translation input exceeds 256 KiB')
    request = json.loads(raw)
    source, target = request.get('from'), request.get('to')
    if (source, target) != ('en', 'es'):
        raise ValueError('Only the installed direct en→es language pair is supported')
    cues = request.get('cues')
    if not isinstance(cues, list) or not 1 <= len(cues) <= 500:
        raise ValueError('Expected 1–500 cues')
    seen = set()
    for cue in cues:
        if not isinstance(cue, dict) or not isinstance(cue.get('id'), (int, str)):
            raise ValueError('Each cue must contain an integer or string id')
        key = (type(cue['id']).__name__, str(cue['id']))
        if key in seen:
            raise ValueError('Cue IDs must be unique')
        seen.add(key)
        if not isinstance(cue.get('text'), str) or not 1 <= len(cue['text']) <= 2000:
            raise ValueError('Each cue must have 1–2000 text characters')
    model = Path(os.environ.get('TRANSLATE_MODEL_DIR', DEFAULT_MODEL))
    if not (model / 'model/model.bin').is_file() or not (model / 'sentencepiece.model').is_file():
        raise ValueError('Translation model unavailable; run scripts/install-translation.py explicitly')
    # Import only inference components. No Argos/Stanza/MiniSBD automatic model download.
    import ctranslate2
    import sentencepiece
    tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(model / 'sentencepiece.model'))
    engine = ctranslate2.Translator(str(model / 'model'), device='cpu', inter_threads=1,
                                   intra_threads=2, compute_type='int8')
    inputs = [tokenizer.encode(cue['text'].replace('\n', ' '), out_type=str) for cue in cues]
    if any(len(tokens) > 512 for tokens in inputs):
        raise ValueError('Cue exceeds 512 model tokens; split it before translation')
    results = engine.translate_batch(inputs, beam_size=4, max_batch_size=8, max_decoding_length=512)
    output = []
    for cue, result in zip(cues, results, strict=True):
        text = tokenizer.decode(result.hypotheses[0]).replace('▁', ' ').replace('_', ' ').strip()
        if not text:
            raise ValueError('Translation produced an empty cue')
        output.append({'id': cue['id'], 'text': text})
    print(json.dumps({'cues': output, 'engine': 'Argos en_es 1.0 / CTranslate2 int8',
                      'from': source, 'to': target}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Do not echo user text, paths, or third-party exception messages.
        message = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        print('Translation failed: ' + message[:400], file=sys.stderr)
        sys.exit(1)
