# One-time asset production

The committed PNGs were rasterized from original pixel-art operations with `draw` and `draw-sheet`. The WAV cues were synthesized with `sfx-synth`; the 32-second score and MIDI were sequenced with `music`.

`art.py`, `audio.py`, and `constants.json` preserve the production recipes. They are development records, not build scripts. They expect the run's CLI tools and `/tmp/art` scratch directory, and a copy of `constants.json` at `/tmp/constants.json`. Run from the repository root. Normal installs and builds only copy the committed assets through `public/assets`.
