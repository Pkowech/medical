// Small shim to satisfy bundling when canvas native bindings are not present.
interface CanvasShim {
  Canvas: new () => unknown;
  Image: new () => unknown;
  ImageData: new () => unknown;
  [key: string]: unknown;
}

class CanvasStub {}
class ImageStub {}
class ImageDataStub {}

const shim: CanvasShim = {
  Canvas: CanvasStub,
  Image: ImageStub,
  ImageData: ImageDataStub,
};

export default shim;

// Also export as CommonJS for code using require()
(module as unknown as { exports: typeof shim }).exports = shim;
