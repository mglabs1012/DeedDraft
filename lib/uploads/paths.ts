/** Keep exactly three segments: the deployed Storage RLS validates firm/deed/file. */
export function uploadPaths(firmId: string, deedId: string, uploadId: string, extension: string) {
  const prefix = `${firmId}/${deedId}/${uploadId}-`;
  return { prefix, path: `${prefix}source.${extension}` };
}
