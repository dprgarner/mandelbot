'use strict';

const fs = require('fs');

const _ = require('underscore');
const Color = require('color');
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


// See: http://c0bra.github.io/color-scheme-js/
exports.randomColours = function() {
  let sparse = _.map([
    Math.floor(Math.random() * 32),
    Math.floor(Math.random() * 16),
    Math.floor(Math.random() * 64),
  ], i => (
    (Math.random() < 0.7) ? i : 255 - i
  ));
  let permute = Math.floor(Math.random() * 3);
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

  let mode = 'normal';
  let modeChoice = Math.random() / 5;
  if (modeChoice < 0.1) {
    mode = 'rainbow';
  } else if (modeChoice < 0.2) {
    mode = 'weird';
  }

  return {
    sparse,
    dense,
    mandelbrot,
    mode,
  };
}

exports.drawMandelbrot = function(mandelbrot, depth, colours) {
  let startTime = Date.now();
  let width = mandelbrot[0].length;
  let height = mandelbrot.length;
  let f = 1 / Math.log(depth);

  let colourR = {};
  let colourG = {};
  let colourB = {};

  const [sparseR, sparseG, sparseB] = colours.sparse;
  const [denseR, denseG, denseB] = colours.dense;
  const [mandelbrotR, mandelbrotG, mandelbrotB] = colours.mandelbrot;

  let minIterations = depth;
  let maxIterations = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mandelbrot[y][x]) {
        minIterations = Math.min(minIterations, mandelbrot[y][x]);
        maxIterations = Math.max(maxIterations, mandelbrot[y][x]);
      }

  const randomRainbowFactor = Math.random() * 50 + 2 * Math.random();
  for (let j = 0; j <= maxIterations; j++) {
    let s;
    if (colours.mode === 'rainbow') {
      s = Math.round(64 * Math.log(j));
      let colour = Color({
        h: Math.round(randomRainbowFactor * (s + 1)),
        s: 85 + 15 * Math.sin(s / 50),
        v: 95 + 5 * Math.sin(s / 33),
      }).rgb().round();

      colourR[j] = colour.red();
      colourG[j] = colour.green();
      colourB[j] = colour.blue();
    } else if (colours.mode === 'weird') {
      colourR[j] = Math.floor(Math.random() * 256);
      colourG[j] = Math.floor(Math.random() * 256);
      colourB[j] = Math.floor(Math.random() * 256);
    } else {
      s = Math.max(0, Math.min(1, f * Math.log(1.5 * (j - minIterations))));
      colourR[j] = Math.round(s * denseR + (1 - s) * sparseR) % 256;
      colourG[j] = Math.round(s * denseG + (1 - s) * sparseG) % 256;
      colourB[j] = Math.round(s * denseB + (1 - s) * sparseB) % 256;
    }
  }

  // Tame the psychedelic madness somewhat. If the pixel is surrounded by
  // pixels of four different colours in rainbow or weird mode, then make the
  // pixel the 'deep colour'.
  const deepColourR = Math.floor(Math.random() * 256);
  const deepColourG = Math.floor(Math.random() * 256);
  const deepColourB = Math.floor(Math.random() * 256);

  function isIsolated(y, x) {
    if (!mandelbrot[y][x]) return false;
    if (y < height - 1 && mandelbrot[y+1][x] && mandelbrot[y][x] === mandelbrot[y+1][x]) return false;
    if (y > 0 && mandelbrot[y-1][x] && mandelbrot[y][x] === mandelbrot[y-1][x]) return false;
    if (x < width - 1 && mandelbrot[y][x+1] && mandelbrot[y][x] === mandelbrot[y][x+1]) return false;
    if (x > 0 && mandelbrot[y][x-1] && mandelbrot[y][x] === mandelbrot[y][x-1]) return false;
    return true;
  }

  let data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let iterations = mandelbrot[y][x];
      let idx = (y * width + x) * 3;
      if (!iterations) {
        data[idx] = mandelbrotR;
        data[idx + 1] = mandelbrotG;
        data[idx + 2] = mandelbrotB;
      } else if (colours.mode !== 'normal' && isIsolated(y, x)) {
        data[idx] = deepColourR;
        data[idx + 1] = deepColourG;
        data[idx + 2] = deepColourB;
      } else {
        data[idx] = colourR[iterations];
        data[idx + 1] = colourG[iterations];
        data[idx + 2] = colourB[iterations];
      }
    }
  }

  let s = new PixelStream(width, height, {colorSpace: 'rgb'})
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
        console.log(`Rendered set to ${frameLocation}`);
        resolve(frameLocation);
      }
    });
  });
};
