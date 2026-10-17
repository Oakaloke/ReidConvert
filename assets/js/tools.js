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
  }
];
