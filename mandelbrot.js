'use strict';

const fs = require('fs');

const _ = require('underscore');
const Color = require('color');
const ColorScheme = require('color-scheme')
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
  // TODO remove this color scheme package as we could just do this by hand
  // better.
  let mbColour, sparseColour, denseColour;

  while (true) {
    mbColour = Color(0);

    console.log('color attempt');
    let scm = new ColorScheme()
    .from_hue(Math.floor(Math.random() * 256))
    .scheme('triade')
    .distance(Math.random())
    .add_complement(false)
    .variation(Math.random() < 0.5 ? 'hard' : 'default')
    .web_safe(true);
    // An array of twelve colours, in three groups of four, where colours in
    // each group are similar hues. The second colour in each group is the darkest,
    // the third colour is the lightest (and is very very pale).

    let colourStrings;
    // There are some bugs in the package :(
    try {
      colourStrings = scm.colors();
    } catch (err) {
      console.error(err);
      continue;
    }
    let colours = _.map(colourStrings, str => Color(`#${str}`));
    console.log(colours);

    if (true || Math.random() < 0.5) {
      // Non-black Mandelbrot. Find a suitable colour (either very dark or very
      // pale)
      let candidates = _.filter(colours, c => 
        c.hsl().lightness() <= 20 //|| c.hsl().lightness() >= 80
      );
      console.log('non-black MB candidates:');
      console.log(candidates);
      if (candidates.length) {
        mbColour = candidates[_.random(candidates.length - 1)];
        colours.splice(colours.indexOf(mbColour) * 4, 4);
        if (mbColour.hsl().lightness() < 20) mbColour.darken(0.9);
        if (mbColour.hsl().lightness() > 80) mbColour.lighten(0.5);
      }
    }
    denseColour = colours[_.random(colours.length - 1)];
    sparseColour = colours[_.random(colours.length - 1)];
    console.log('dense colour:', denseColour.hsl().array())
    console.log('sparse colour:', sparseColour.hsl().array())
    console.log('mb colour:', mbColour.hsl().array())

    const lightnessDifference = (color1, color2) => (
      Math.abs(color1.hsl().lightness() - color2.hsl().lightness())
    );

    function hueDifference(color1, color2) {
      let naiveDifference = Math.abs(color1.hsl().hue() - color2.hsl().hue());
      return Math.min(naiveDifference, 360 - naiveDifference);
    }

    if (hueDifference(denseColour, sparseColour) < 75) continue;
    if (hueDifference(mbColour, denseColour) < 75) continue;
    if (lightnessDifference(denseColour, sparseColour) < 40) continue;
    if (lightnessDifference(mbColour, denseColour) < 40) continue;
    if (lightnessDifference(sparseColour, mbColour) < 20) continue;
    break;
  }

  let mode = 'normal';
  let modeChoice = Math.random() / 5;
  if (modeChoice < 0.1) {
    mode = 'rainbow';
  } else if (modeChoice < 0.2) {
    mode = 'weird';
  }

  return {
    sparse: sparseColour.rgb().round().array(),
    dense: denseColour.rgb().round().array(),
    mandelbrot: mbColour.rgb().round().array(),
    mode: 'normal',
  };
}

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
    if (colours.mode === 'rainbow') {
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
      } else if (colours.mode !== 'normal' && isIsolated(y, x)) {
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
        console.error(err);
        reject(err);
      } else {
        console.log(`Rendered set to ${frameLocation}`);
        resolve(frameLocation);
      }
    });
  });
};
