'use strict';

const fs = require('fs');

const _ = require('underscore');
const GIFEncoder = require('gif-stream/encoder');
const neuquant = require('neuquant');
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

  // Clear orphans...
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (set[y][x]) continue;
      if (y < height - 1 && !set[y+1][x]) continue;
      if (y > 0 && !set[y-1][x]) continue;
      if (!set[y][x+1] || !set[y][x-1]) continue;
      set[y][x] = depth;
    }
  }

  return set;
};

exports.randomColours = function() {
  let sparse = _.map([
    Math.floor(Math.random() * 32),
    Math.floor(Math.random() * 16),
    Math.floor(Math.random() * 64),
  ], i => (
    (Math.random() < 0.7) ? i : 255 - i
  ));
  let permute = Math.floor(Math.random() * 3)
  if (permute > 0) sparse.splice(0, 0, sparse.pop());
  if (permute > 1) sparse.splice(0, 0, sparse.pop());

  let dense = _.map(sparse, (i) => (
    Math.max(0, Math.min(255, 255 - i + Math.floor((Math.random() * 16) - 2) * 16))
  ));
  let mandelbrot = [0, 0, 0];

  if (Math.random() < 0.5) {
    sparse = _.map(sparse, i => 255 - i);
    dense = _.map(dense, i => 255 - i);

    if (Math.random() < 0.5) {
      sparse = _.map(sparse, i => Math.random() < 0.7 ? Math.round(i / 2) : i);
      mandelbrot = _.map([255, 255, 255], i => (
        Math.random() < 0.7 ? i : 255 - Math.floor(Math.random() * 64)
      ));
    }
  }

  const psychedelic = Math.random() < 0.1;

  return {
    sparse,
    dense,
    mandelbrot,
    psychedelic,
  };
}

exports.drawMandelbrot = function(mandelbrot, depth, colours) {
  let startTime = Date.now();
  let width = mandelbrot[0].length;
  let height = mandelbrot.length;
  let f = 1 / Math.log(depth);

  let colorR = {};
  let colorG = {};
  let colorB = {};

  if (!colours) throw new Error('no colours');

  const [sparseR, sparseG, sparseB] = colours && colours.sparse || [0, 0, 255];
  const [denseR, denseG, denseB] = colours && colours.dense || [255, 255, 0];
  const [mandelbrotR, mandelbrotG, mandelbrotB] = colours && colours.mandelbrot || [0, 0, 0];

  let minIterations = depth;
  let maxIterations = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mandelbrot[y][x]) {
        minIterations = Math.min(minIterations, mandelbrot[y][x]);
        maxIterations = Math.max(maxIterations, mandelbrot[y][x]);
      }

  for (let j = 0; j <= maxIterations; j++) {
    let s;
    if (colours && colours.psychedelic) {
      s = Math.pow(f * j, 0.25);
    } else {
      s = 256 * Math.max(0, Math.min(1, f * Math.log(1.5 * (j - minIterations))));
    }

    colorR[j] = Math.round(s * denseR + (1 - s) * sparseR) % 256;
    colorG[j] = Math.round(s * denseG + (1 - s) * sparseG) % 256;
    colorB[j] = Math.round(s * denseB + (1 - s) * sparseB) % 256;
  }

  let s = new PixelStream(width, height, {colorSpace: 'rgb'})
  let data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let iterations = mandelbrot[y][x];
      let idx = (y * width + x) * 3;
      if (!iterations) {
        data[idx] = mandelbrotR;
        data[idx + 1] = mandelbrotG;
        data[idx + 2] = mandelbrotB;
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

exports.renderSetToFile = function(set, params, frameLocation) {
  return new Promise((resolve, reject) => {
    exports.drawMandelbrot(set, params.depth, params.colours)
    .pipe(new neuquant.Stream(params.width, params.height, {colorSpace: 'rgb'}))
    .pipe(new GIFEncoder)
    .pipe(fs.createWriteStream(frameLocation))
    .on('finish', (err) => {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        resolve(frameLocation);
      }
    });
  });
};
