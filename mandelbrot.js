'use strict';

const Jimp = require('jimp');

function convergesWithin(depth, cRe, cIm) {
  // z -> z' = z^2 + c
  // zRe' + i * zIm'
  // = (zRe + i * zIm)^2 + cRe + i * cIm
  // = (zRe^2 - zIm^2 + cRe) + i(2 * zRe * zIm + cIm)

  let zRe = cRe, zIm = cIm;
  for (let i = 1; i < depth; i++) {
    if (zRe * zRe + zIm * zIm > 4) return i;
    let nextZRe = zRe * zRe - zIm * zIm + cRe;
    let nextZIm = 2 * zRe * zIm + cIm;
    zRe = nextZRe;
    zIm = nextZIm;
  }
  return null;
};

exports.constructSet = function(params) {
  let width = params.width;
  let height = params.height;
  let centerX = params.x;
  let centerY = params.y;
  let scale = params.scale;
  let depth = params.depth;

  let set = [];
  let startX = centerX - scale * width / 2;
  let startY = centerY + scale * height / 2;
  for (let y = 0; y < height; y++) {
    set[y] = [];
    for (let x = 0; x < width; x++) {
      set[y][x] = convergesWithin(depth, startX + scale * x, startY - scale * y);
    }
  }
  return set;
};

exports.drawMandelbrot = function(mandelbrot, depth) {
  let width = mandelbrot[0].length;
  let height = mandelbrot.length;

  let min = depth;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mandelbrot[y][x])
        min = Math.min(min, mandelbrot[y][x]);

  return new Promise((resolve, reject) => {
    new Jimp(width, height, 0x000000ff, function (err, image) {
      if (err) return reject(err);

      image.scan(0, 0, width, height, function (x, y, idx) {
        let iterations = mandelbrot[y][x];
        if (!iterations) return;
        this.bitmap.data[idx] = Math.max(0, Math.min(255, Math.round(255 * Math.log(1.5 * (iterations - min)) / Math.log(depth))));
        this.bitmap.data[idx+1] = this.bitmap.data[idx];
        this.bitmap.data[idx+2] = 255 - this.bitmap.data[idx];
      });

      resolve(image);
    })
  });
};