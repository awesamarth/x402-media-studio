# Local English to Spanish subtitle translation

The adapter translates cue text on this machine without a hosted API. It supports the installed **English (`en`) → Spanish (`es`)** direct model only. It preserves cue IDs and order; the worker preserves and rewrites the original cue timings. It does not align speech or translate other language pairs by pivoting.

## Install explicitly

Run from the project root (requires `uv` and network access during setup):

```sh
python3 scripts/install-translation.py
```

The installer creates `.runtime/translation/venv` using Python 3.12 and downloads the archive linked by the [official Argos registry](https://github.com/argosopentech/argospm-index). It verifies a pinned SHA-256 before extracting. Runtime inference never downloads anything; missing model files cause an actionable error.

Configure:

```sh
TRANSLATE_PYTHON=/absolute/project/.runtime/translation/venv/bin/python
TRANSLATE_MODEL_DIR=/absolute/project/.runtime/translation/models/en_es
```

`TRANSLATE_MODEL_DIR` is the extracted package directory containing `model/model.bin` and `sentencepiece.model`, not the parent models directory. No `ARGOS_PACKAGES_DIR` is needed: inference reads this one package directly using CTranslate2 and SentencePiece, without importing Argos sentence-splitting components that may auto-download extra models. The package manifest is `.runtime/translation/model-manifest.json`; `runtime-manifest.json` inside the model directory records inference package versions for cache invalidation.

## Test the real model

```sh
printf '%s' '{"from":"en","to":"es","cues":[{"id":1,"text":"Hello world. This is a test."},{"id":2,"text":"Please close the door."}]}' | .runtime/translation/venv/bin/python scripts/translate.py
```

The interface reads one JSON object from stdin and writes one JSON object to stdout. Errors go to stderr with a nonzero exit. Limits: 256 KiB request, 500 cues, 2,000 characters and 512 model tokens per cue. CPU inference uses int8, one batch worker and two intra-operation threads. Subtitle cues are translated independently, so context and linguistic quality need human review.

## Dependencies and deployment

`runtime/translation/requirements.txt` pins the direct packages; `requirements-macos-arm64.lock` records the full tested Mac environment. The inference path uses CTranslate2 4.8.3 and SentencePiece 0.2.2 with the Argos en_es 1.0 package. Argos 1.11.0 was also inspected and installed during local setup, but its heavyweight NLP dependencies are neither needed nor installed by this project installer. The unused Argos/Torch/Stanza/Spacy packages were subsequently removed from the project virtualenv with `uv pip sync`. The final environment contains only CTranslate2 4.8.3, SentencePiece 0.2.2, NumPy 2.5.4 and PyYAML 6.0.3.

For Linux ARM64, create the same project-local Python 3.12 environment using `uv`, then run the installer. The installer selects the hashed Linux ARM64 lock instead of copying the Mac virtualenv. Pinned binary-wheel resolution for aarch64-unknown-linux-gnu succeeded using uv pip compile with --only-binary :all:. Actual CTranslate2 import/inference and performance still need verification on the VPS; no Linux runtime was executed here. Keep heavy jobs serialized and benchmark there; Mac timings do not predict two-core VPS latency. No VPS installation has been performed.

Argos code is [MIT licensed](https://github.com/argosopentech/argos-translate/blob/master/LICENSE); the [registry](https://github.com/argosopentech/argospm-index) declares MIT/CC0 for its index. These statements do not automatically establish a model or its training data license. Preserve and review the model archive's bundled metadata/license before redistributing it; deployment of downloaded weights and redistribution have different obligations.

## Verified local evidence

On this Apple ARM64 Mac using Python 3.12.13, the two-cue command above produced `Hola mundo, esto es una prueba.` and `Por favor, cierra la puerta.`. First process wall time was 0.67 seconds; a subsequent fresh process was 0.231 seconds. These are tiny-input measurements, not throughput or quality guarantees. Typed IDs (`"first"` and integer `2`) and cue count were preserved. Evidence: `.runtime/translation/verified-translation.json`.

Archive: **87,503,191 bytes** (83.45 MiB), SHA-256 `d698d0ef87ad70d5d184b7fa6965905bf4368f09a2bb9ffb165a79bac96af0c4`, from `https://argos-net.com/v1/translate-en_es-1_0.argosmodel`. Extracted contents total 96,243,365 bytes. `model/model.bin`: **94,392,546 bytes**, SHA-256 `d5771f823c9dd7eedcf9367c116aede65613a194f761a81826351e2bccb194c4`. Full per-file sizes/hashes: `.runtime/translation/model-files.json`. The requirements lock includes registry package artifact hashes.

The archive's README says the model was trained on OpenSubtitles, ParaCrawl and UNPC corpora compiled by OPUS, and includes Stanza pretrained assets. It contains **no explicit license for the translation weights**. The bundled Stanza assets are not loaded by this adapter. This licensing gap remains a redistribution check; no broader license is invented here.
