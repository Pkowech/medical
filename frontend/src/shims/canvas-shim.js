/* eslint-disable */

// Typescript-friendly shim exported as CommonJS and ESM to satisfy
// both `require('canvas')` and `import canvas from 'canvas'` usage.
const shim: any = {
  Canvas: function () { return null; },
  Image: function () { return null; },
  ImageData: function () { return null; },
};

// Interop for ESM imports
export default shim;

// Interop for CommonJS require
module.exports = shim;
