/* ReidConvert — central tool registry.
 * The homepage grid, the header nav dropdown, and the footer links are ALL
 * generated from this array. To add a converter: create its folder (e.g.
 * /png-to-jpg/index.html) and add one entry below. See ADDING-A-TOOL.md.
 *
 * Fields:
 *   key      unique slug (matches the folder name)
 *   name     display name
 *   from     source format label (used for homepage drop routing)
 *   to       target format label
 *   url      clean URL (leading + trailing slash)
 *   desc     one-line description for cards / meta
 *   category grouping label ("Image", "Document", ...)
 *   status   "live" or "soon"
 *   accept   (optional) extensions this tool accepts, used for drop routing
 */
window.RC_TOOLS = [
  {
    key: 'heic-to-jpg',
    name: 'HEIC to JPG',
    from: 'HEIC',
    to: 'JPG',
    url: '/heic-to-jpg/',
    desc: 'Convert iPhone HEIC & HEIF photos to universal JPG images.',
    category: 'Image',
    status: 'live',
    accept: ['heic', 'heif']
  },
  {
    key: 'pdf-to-word',
    name: 'PDF to Word',
    from: 'PDF',
    to: 'Word',
    url: '/pdf-to-word/',
    desc: 'Turn PDFs into editable Word documents — keeps real text, OCRs scans.',
    category: 'Document',
    status: 'live',
    accept: ['pdf']
  },
  {
    key: 'pdf-to-jpg',
    name: 'PDF to JPG',
    from: 'PDF',
    to: 'JPG',
    url: '/pdf-to-jpg/',
    desc: 'Turn every page of a PDF into a high-quality JPG image.',
    category: 'Document',
    status: 'live'
    // no `accept`: homepage PDF drops route to PDF→Word (the established tool);
    // reach this tool from the grid/nav until a multi-match chooser exists.
  },
  {
    key: 'merge-pdf',
    name: 'Merge PDF',
    from: 'PDF',
    to: 'PDF',
    url: '/merge-pdf/',
    desc: 'Combine several PDF files into one, in any order you choose.',
    category: 'Document',
    status: 'live'
  },
  {
    key: 'split-pdf',
    name: 'Split PDF',
    from: 'PDF',
    to: 'PDF',
    url: '/split-pdf/',
    desc: 'Extract page ranges or split a PDF into separate files.',
    category: 'Document',
    status: 'live'
  },
  {
    key: 'compress-pdf',
    name: 'Compress PDF',
    from: 'PDF',
    to: 'PDF',
    url: '/compress-pdf/',
    desc: 'Shrink large scanned or image-heavy PDFs to a smaller file.',
    category: 'Document',
    status: 'live'
  },
  {
    key: 'png-to-jpg',
    name: 'PNG to JPG',
    from: 'PNG',
    to: 'JPG',
    url: '/png-to-jpg/',
    desc: 'Flatten PNG images into smaller, shareable JPG files.',
    category: 'Image',
    status: 'live',
    accept: ['png']
  },
  {
    key: 'jpg-to-png',
    name: 'JPG to PNG',
    from: 'JPG',
    to: 'PNG',
    url: '/jpg-to-png/',
    desc: 'Convert JPG photos to lossless PNG images.',
    category: 'Image',
    status: 'live',
    accept: ['jpg', 'jpeg']
  },
  {
    key: 'webp-to-jpg',
    name: 'WEBP to JPG',
    from: 'WEBP',
    to: 'JPG',
    url: '/webp-to-jpg/',
    desc: 'Turn modern WEBP images into widely supported JPG files.',
    category: 'Image',
    status: 'live',
    accept: ['webp']
  },
  {
    key: 'jpg-to-pdf',
    name: 'JPG to PDF',
    from: 'JPG',
    to: 'PDF',
    url: '/jpg-to-pdf/',
    desc: 'Combine one or more JPG images into a single PDF document.',
    category: 'Document',
    status: 'live',
    accept: ['jpg', 'jpeg']
  },
  {
    key: 'image-to-webp',
    name: 'Image to WEBP',
    from: 'PNG / JPG',
    to: 'WEBP',
    url: '/image-to-webp/',
    desc: 'Convert PNG and JPG images to smaller, modern WEBP files.',
    category: 'Image',
    status: 'live'
    // no `accept`: PNG/JPG drops route to their primary converters; reach this tool from the grid/nav.
  },
  {
    key: 'compress-image',
    name: 'Compress Image',
    from: 'JPG / PNG / WEBP',
    to: 'Smaller',
    url: '/compress-image/',
    desc: 'Shrink JPG, PNG and WEBP file sizes while keeping them looking great.',
    category: 'Image',
    status: 'live'
    // no `accept`: avoids clobbering the primary image routes on homepage drop.
  },
  {
    key: 'mp4-to-mp3',
    name: 'MP4 to MP3',
    from: 'MP4',
    to: 'MP3',
    url: '/mp4-to-mp3/',
    desc: 'Extract the audio track from an MP4 video as an MP3 file.',
    category: 'Audio',
    status: 'beta'
    // no `accept`: several tools take MP4; reach this from the grid/nav.
  },
  {
    key: 'flac-to-mp3',
    name: 'FLAC to MP3',
    from: 'FLAC',
    to: 'MP3',
    url: '/flac-to-mp3/',
    desc: 'Convert lossless FLAC audio to compact, universal MP3 — keeps tags.',
    category: 'Audio',
    status: 'beta',
    accept: ['flac']
  },
  {
    key: 'mp4-to-gif',
    name: 'MP4 to GIF',
    from: 'MP4',
    to: 'GIF',
    url: '/mp4-to-gif/',
    desc: 'Turn a short MP4 clip into a shareable animated GIF.',
    category: 'Video',
    status: 'beta'
    // no `accept`: several tools take MP4; reach this from the grid/nav.
  },
  {
    key: 'mov-to-mp4',
    name: 'MOV to MP4',
    from: 'MOV',
    to: 'MP4',
    url: '/mov-to-mp4/',
    desc: 'Convert Apple QuickTime MOV videos to universal MP4 (H.264).',
    category: 'Video',
    status: 'beta',
    accept: ['mov', 'qt']
  },
  {
    key: 'compress-video',
    name: 'Compress Video',
    from: 'MP4 / MOV',
    to: 'MP4',
    url: '/compress-video/',
    desc: 'Shrink MP4 and MOV videos to fit email, chat and upload limits.',
    category: 'Video',
    status: 'beta'
    // no `accept`: several tools take MP4; reach this from the grid/nav.
  }
];
