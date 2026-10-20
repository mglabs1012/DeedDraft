-- Browser-to-Storage resumable uploads; keep bucket private, size limit and RLS unchanged.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/tiff', 'image/bmp', 'image/avif', 'image/heic', 'image/heif',
  'application/zip', 'application/vnd.rar',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'deed-documents';
