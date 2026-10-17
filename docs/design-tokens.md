# ReidConvert design tokens

These are the single source of visual truth, defined as CSS custom properties at the top of
`assets/css/main.css` (`:root`). Every converter page — image, document, media and the bespoke
PDF/auth pages — reuses them, so the whole site stays consistent. **Do not hard-code colours;
use the variables.**

## Colour
| Token | Value | Use |
|-------|-------|-----|
| `--navy` | `#01295D` | Brand primary / theme-color / headers |
| `--navy-700` | `#06336e` | Hover/raised navy |
| `--navy-900` | `#021c42` | Deepest navy |
| `--gold` | `#C29039` | Accent, primary action (`.btn-gold`) |
| `--gold-600` | `#a4771f` | AA-contrast gold text on light |
| `--gold-100` | `#f6edda` | Gold tint backgrounds |
| `--ink` | `#13233d` | Headings |
| `--body` | `#3a475c` | Body text |
| `--muted` | `#677488` | Secondary text |
| `--line` | `#e2e7ef` | Borders / dividers |
| `--bg` | `#ffffff` | Page background |
| `--bg-soft` | `#f4f7fc` | Soft section background (`.section-soft`) |
| `--ok` / `--ok-bg` | `#0f7a4f` / `#e7f6ee` | Success |
| `--warn` | `#b4540a` | Warnings |
| `--err` / `--err-bg` | `#c0392b` / `#fdecea` | Errors |

## Shape, elevation, layout
| Token | Value |
|-------|-------|
| `--radius` / `--radius-sm` | `14px` / `10px` |
| `--shadow-sm` | `0 1px 2px rgba(5,25,60,.06), 0 2px 8px rgba(5,25,60,.05)` |
| `--shadow` | `0 6px 24px rgba(5,25,60,.09)` |
| `--shadow-lg` | `0 18px 50px rgba(5,25,60,.14)` |
| `--maxw` | `1120px` (container width) |
| `--font` | `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` |

## Shared components (class names)
- **Buttons:** `.btn`, `.btn-gold` (primary), `.btn-ghost`, `.btn-lg`, `.btn-sm`.
- **Converter workspace:** `.cv`, `.cv-drop` (drop zone), `.cv-privacy`, `.cv-list`, `.cv-row`,
  `.cv-info`, `.cv-name`, `.cv-prog` / `.cv-prog-bar`, `.cv-state`, `.cv-notice`,
  `.cv-opt`, `.cv-field-row`, `.cv-field-col`, `.cv-modal*`.
- **Page shell:** `.tool-hero`, `.app` / `.app-wrap`, `.section` / `.section-soft`, `.prose`,
  `.faq`, `.tool-grid`, `.tool-card`, `.badge`, `.breadcrumb`.

The image workspace is created by `RC.createWorkspace` (`convert-core.js`), the document
workspace by `RC.createDocWorkspace` (`doc-convert-core.js`), and the audio/video workspace by
`RC.createMediaWorkspace` (`media-core.js`). All three render the same `.cv-*` markup.
