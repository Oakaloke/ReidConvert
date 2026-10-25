# Read Aloud implementation notes

This tool does not invoke the homepage's IndexedDB file handoff. Open the reader before choosing a document. Manuscripts are held only in page memory; imported third-party code and model assets are fetched, but text is not sent in network requests. The browser may cache models/voices. Downloads are intentionally saved by the user.

Pinned browser libraries: kokoro-js1.2.1 bundled ESM, JSZip3.10.1, pdfjs-dist4.10.38. Upstream ONNX and voice asset paths follow their current main revision (not falsely claimed pinned). Worker WASM q8 inference does not require WebGPU. No speechSynthesis fallback.

Text chunks have a hard280-character cap. Chapters over3500words are split into3000-word listening sections to bound retained16bit PCM. UI invalidates stale parses and generation jobs; cancellation terminates the worker. Object URLs are revoked on replacement/clear/unload. DOCX compressed files capped50MB and expanded document XML30MB; text3million characters. No scanned-PDF OCR.

Synthetic QA only. Never add a private manuscript as a fixture. Physical iPhone/background playback are not guaranteed.

## Whole-book MP4 extension
Pinned Mediabunny1.62.1 and official AAC WASM fallback1.62.1. Standard audio-only MP4, AAC-LC64kbps/24kHz mono. Output uses positional writes to a private browser temporary file with1MiB write chunks, never a whole-book PCM buffer. One generated segment is encoded with awaited backpressure, then released. Timeline is cumulative numeric sample count across every chapter; no32bit bitwise truncation. An idle section voice worker is terminated before book generation to avoid duplicate voice models. Native AAC probe falls back to official local WASM AAC encoder.

Unlike section playback, whole-book audio intentionally uses browser disk storage. Cancel/clear/replacement removes it; page close attempts cleanup but is not guaranteed. Files older than24hours are removed on the next reader visit. No manuscript text is persisted. No resume after cancellation; complete MP4 must be downloaded before clear. Local-storage unsupported/quota errors fail honestly without a mislabeled download.

Synthetic encoder stress test generated600seconds AAC using the same library/streaming positional target: ffprobe AAC24kHz mono,600.064seconds,4931510bytes, validMP4. Long-text reconstruction106000words/37sections/5614chunks lossless, every chunk<=280characters. Cumulative sample timeline tested31.2billion samples without32bit overflow. This is not a claim to have synthesized a real7.5hour book.
