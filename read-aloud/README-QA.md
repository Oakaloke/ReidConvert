# Read Aloud implementation notes

This tool does not invoke the homepage's IndexedDB file handoff. Open the reader before choosing a document. Manuscripts are held only in page memory; imported third-party code and model assets are fetched, but text is not sent in network requests. The browser may cache models/voices. Downloads are intentionally saved by the user.

Pinned browser libraries: kokoro-js1.2.1 bundled ESM, JSZip3.10.1, pdfjs-dist4.10.38. Upstream ONNX and voice asset paths follow their current main revision (not falsely claimed pinned). Worker WASM q8 inference does not require WebGPU. No speechSynthesis fallback.

Text chunks have a hard280-character cap. Chapters over3500words are split into3000-word listening sections to bound retained16bit PCM. UI invalidates stale parses and generation jobs; cancellation terminates the worker. Object URLs are revoked on replacement/clear/unload. DOCX compressed files capped50MB and expanded document XML30MB; text3million characters. No scanned-PDF OCR.

Synthetic QA only. Never add a private manuscript as a fixture. Physical iPhone/background playback are not guaranteed.
