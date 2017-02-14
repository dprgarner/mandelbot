'use strict';

const fs = require('fs');

const _ = require('underscore');
const chroma = require('chroma-js');
const Color = require('color');
const GIFEncoder = require('gif-stream/encoder');
const neuquant = require('neuquant');
const PixelStream = require('pixel-stream');
const winston = require('winston');

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
  let sparseColour, denseColour, mandelbrotColour;

  do {
    denseColour = Color(chroma.random().hex());
    denseColour.saturate(0.5 + 0.5 * Math.random());

    sparseColour = Color(chroma.random().hex());
    sparseColour.saturate(0.5 + 0.5 * Math.random());

    mandelbrotColour = Color(0);
    if (Math.random() < 0.2) {
      mandelbrotColour = Color(chroma.random().hex()).darken(0.7);
      mandelbrotColour.saturate(0.5 + 0.5 * Math.random());
    }

    if (Math.random() < 0.25) {
      denseColour = denseColour.negate();
      sparseColour = sparseColour.negate();
      mandelbrotColour = mandelbrotColour.negate();
    }
  } while (
    chroma.contrast(denseColour.hex(), sparseColour.hex()) < 4.5 ||
    chroma.contrast(mandelbrotColour.hex(), sparseColour.hex()) < 2
  )

  let mode = 'normal';
  let modeChoice = _.random(3);
  if (modeChoice === 0) {
    mode = 'rainbow';
  } else if (modeChoice === 1) {
    mode = 'weird';
  }

  return {
    mode,
    sparse: sparseColour.rgb().round().array(),
    dense: denseColour.rgb().round().array(),
    mandelbrot: mandelbrotColour.rgb().round().array(),
  };
};

exports.drawMandelbrot = function(mandelbrot, depth, colours) {
  let startTime = Date.now();
  let width = mandelbrot[0].length;
  let height = mandelbrot.length;
  let f = 1 / Math.log(depth);

  let minIterations = depth;
  let maxIterations = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mandelbrot[y][x]) {
        minIterations = Math.min(minIterations, mandelbrot[y][x]);
        maxIterations = Math.max(maxIterations, mandelbrot[y][x]);
      }

  let colourAtDepth = [];
  const randomRainbowFactor = Math.random() * 50 + 2 * Math.random();
  for (let j = 0; j <= maxIterations; j++) {
    let s;
    if (colours.mode === 'sparse') {  
      s = Math.min(1, Math.pow(
        (j - minIterations) / (maxIterations / 2 - minIterations), 0.5
      ));
      colourAtDepth[j] = _.times(3, i => (
        Math.floor(s * colours.dense[i] + (1 - s) * colours.sparse[i])
      ));
    } else if (colours.mode === 'rainbow') {
      s = Math.round(64 * Math.log(j));
      colourAtDepth[j] = Color({
        h: Math.round(randomRainbowFactor * (s + 1)) % 256,
        s: Math.round(65 + Math.random() * 15 * Math.sin(s / 50)),
        v: Math.round(95 + 5 * Math.sin(s / 33)),
      }).rgb().round().array();
    } else if (colours.mode === 'weird') {
      colourAtDepth[j] = _.times(3, () => Math.floor(Math.random() * 256));
    } else {
      s = Math.max(0, Math.min(1, f * Math.log(1.5 * (j - minIterations))));
      colourAtDepth[j] = _.times(3, i => (
        Math.floor(s * colours.dense[i] + (1 - s) * colours.sparse[i]) % 256
      ));
      // Oversaturate the colours somewhat
      colourAtDepth[j] = Color(colourAtDepth[j]).saturate(0.75).rgb().array()
    }
  }

  // Tame the psychedelic madness somewhat. If the pixel is surrounded by
  // pixels of four different colours in rainbow or weird mode, then make the
  // pixel the 'deep colour'.
  const deepColour = [
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
  ];

  function isIsolated(y, x) {
    if (!mandelbrot[y][x]) return false;
    if (y < height - 1 && mandelbrot[y+1][x] && mandelbrot[y][x] === mandelbrot[y+1][x]) return false;
    if (y > 0 && mandelbrot[y-1][x] && mandelbrot[y][x] === mandelbrot[y-1][x]) return false;
    if (x < width - 1 && mandelbrot[y][x+1] && mandelbrot[y][x] === mandelbrot[y][x+1]) return false;
    if (x > 0 && mandelbrot[y][x-1] && mandelbrot[y][x] === mandelbrot[y][x-1]) return false;
    return true;
  }

  let data = Buffer.alloc(width * height * 3);
  const appendColour = (idx, colour) => _.each(_.range(3), i => {
    data[idx + i] = colour[i];
  });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let iterations = mandelbrot[y][x];
      let idx = (y * width + x) * 3;
      if (!iterations) {
        appendColour(idx, colours.mandelbrot);
      } else if (
        (colours.mode === 'weird' || colours.mode === 'rainbow')
        && isIsolated(y, x)
      ) {
        appendColour(idx, deepColour);
      } else {
        appendColour(idx, colourAtDepth[iterations]);
      }
    }
  }

  let s = new PixelStream(width, height, {colorSpace: 'rgb'});
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
        winston.error(err);
        reject(err);
      } else {
        winston.debug(`Rendered set to ${frameLocation}`);
        resolve(frameLocation);
      }
    });
  });
};
