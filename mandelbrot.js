'use strict';

const PixelStream = require('pixel-stream');

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
  let startTime = Date.now();
  let width = mandelbrot[0].length;
  let height = mandelbrot.length;
  let f = 255 / Math.log(depth);

  let colorR = {};
  let colorG = {};
  let colorB = {};

  let minIterations = depth;
  let maxIterations = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mandelbrot[y][x]) {
        minIterations = Math.min(minIterations, mandelbrot[y][x]);
        maxIterations = Math.max(maxIterations, mandelbrot[y][x]);
      }

  for (let j = 0; j <= maxIterations; j++) {
    let s = Math.max(0, Math.min(255, Math.round(f * Math.log(1.5 * (j - minIterations)))));
    colorR[j] = s;
    colorG[j] = s;
    colorB[j] = 255 - s;
  }

  let s = new PixelStream(width, height, {colorSpace: 'rgb'})
  let data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let iterations = mandelbrot[y][x];
      let idx = (y * width + x) * 3;
      if (!iterations) {
        data[idx] = data[idx + 1] = data[idx + 2] = 0;
      } else {
        data[idx] = colorR[iterations];
        data[idx + 1] = colorG[iterations];
        data[idx + 2] = colorB[iterations];
      }
    }
  }
  s.push(data);
  s.end();
  return s;
};