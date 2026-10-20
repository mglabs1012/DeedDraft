declare module "heic-decode" {
  type DecodedImage = { width: number; height: number; data: Uint8ClampedArray };
  type ImageHandle = { width: number; height: number; decode(): Promise<DecodedImage> };
  type ImageHandles = ImageHandle[] & { dispose(): void };
  const decode: {
    (input: { buffer: Uint8Array }): Promise<DecodedImage>;
    all(input: { buffer: Uint8Array }): Promise<ImageHandles>;
  };
  export default decode;
}
