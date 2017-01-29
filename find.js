const fs = require('fs');

const _ = require('underscore');
const GIFEncoder = require('gif-stream/encoder');
const md5 = require('md5');
const neuquant = require('neuquant');
const rimrafSync = require('rimraf').sync;

const constructSet = require('./mandelbrot').constructSet;
const renderSetToFile = require('./mandelbrot').renderSetToFile;

function collateDepths(set, {width, height, depth}) {
  let startTime = Date.now();
  // console.log(`Collating depths...`);
  let depthsCollation = {[null]: [], orphans: []};
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let depth = set[y][x];
      if (!depthsCollation[depth]) depthsCollation[depth] = [];
      depthsCollation[depth].push({x, y});
    }
  }

  // Check for 'orphans' - Mandelbrot points next to no other points
  for (let {x, y} of depthsCollation[null]) {
    if (y < height - 1 && !set[y+1][x]) continue;
    if (y > 1 && !set[y-1][x]) continue;
    if (!set[y][x+1] || !set[y][x-1]) continue;
    depthsCollation.orphans.push({x, y}) 
  }

  for (let i = 0; i < depth; i++) {
    if (depthsCollation[i]) depthsCollation.maxDepth = i;
  }
  // console.log(`Collated depths after ${Date.now() - startTime}ms`);
  return depthsCollation;
}

function toComplexCoords({pixelX, pixelY}, {x, y, width, height, scale}) {
  // Convert back to complex coordinates
  let newX = x + (pixelX - width / 2) * scale;
  let newY = y - (pixelY - height / 2) * scale;
  return {x: newX, y: newY}; 
}

function getInterestingPixelFromDepths(
  depthsCollation, {x, y, width, height, depth, scale}, threshold
) {
  let tally = 0;
  let topPercentileDepth = null;

  for (let i = depth; i > 0; i--) {
    if (!depthsCollation[i]) continue;

    tally += depthsCollation[i].length;
    if (tally > threshold) {
      topPercentileDepth = i;
      break;
    }
  }

  let pointsAtDepth = depthsCollation[topPercentileDepth];
  let {x: pixelX, y: pixelY} = pointsAtDepth[
    Math.floor(Math.random() * pointsAtDepth.length)
  ];

  return toComplexCoords({pixelX, pixelY}, {x, y, width, height, scale});
}

function getInterestingMandelbrotPoint(
  depthsCollation, {x, y, width, height, depth, scale}
) {
  let {x: pixelX, y: pixelY} = depthsCollation[null][
    Math.floor(Math.random() * depthsCollation[null].length)
  ];
  return toComplexCoords({pixelX, pixelY}, {x, y, width, height, scale});
}


function iterativelyGeneratePixels({width, height}) {
  let depthAdjust = 500;

  let x = -0.5;
  let y = 0;
  let level = 0;
  let depth = depthAdjust + 100 * level;

  let redraws = 0;
  let targetLevel = 20;
  let done = false;

  for (let i = 0; i < 20; i++) {
    depth = depthAdjust + 100 * level;
    let params = {
      scale: Math.pow(2, -6 - level), // (size in complex coords) / (size in pixels)
      x,
      y, 
      depth,
      width,
      height,
      level,
    };

    console.log(`
    ${i}: Level: ${level}, Depth: ${depth}`);

    let startTime = Date.now();
    // console.log(`Constructing Mandelbrot set...`);
    let set = constructSet(params);
    // console.log(`Constructed Mandelbrot set after ${Date.now() - startTime}ms`);

    renderSetToFile(set, params, `./frames/${i}_${level}_${depth}_${x}_${y}.gif`)
    .then((frameLocation) => {
      console.log(`Outputted keyFrame to ${frameLocation}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });

    let depthsCollation = collateDepths(set, {width, height, depth});
    let threshold = Math.floor(
      (0.1 * Math.random()) * (width * height - depthsCollation[null].length)
    );

    let orphansPercent = 100 * depthsCollation.orphans.length / (width * height);
    console.log(`Orphans at level ${level}: ${depthsCollation.orphans.length} (${orphansPercent}%)`);
    if (orphansPercent > 0.75) {
      if (redraws < 3) {
        console.log('Too many orphans - adjusting depth');
        redraws++;
        depthAdjust += 100;
      } else {
        console.log('Too many orphans - zooming out');
        level -= 4;
        redraws = 0;
      }
      continue;
    }

    if (depthsCollation.maxDepth < depth / 10 && redraws < 3) {
      if (!depthsCollation[null].length) {
        console.log('Nothing interesting here: zooming out');
        level = Math.max(level - 4, 0);
      } else {
        console.log('Depth unnecessarily high: adjusting...') 
        depthAdjust = Math.round(depthAdjust / 2);
      }
      redraws++;
      continue;
    }

    if (level < targetLevel - 4) {
      let deepPixel = getInterestingPixelFromDepths(depthsCollation, params, threshold);
      x = deepPixel.x;
      y = deepPixel.y;
      level += 4;
    } else if (level < targetLevel) {
      let ratioOfMandelbrotPoints = depthsCollation[null].length / (width * height);
      if (ratioOfMandelbrotPoints > 0.1 || ratioOfMandelbrotPoints === 0) {
        level -=2;
        continue;
      }
      let deepPixel = getInterestingMandelbrotPoint(depthsCollation, params);
      x = deepPixel.x;
      y = deepPixel.y;
      level += 1;
    } else {
      let deepPixel = getInterestingMandelbrotPoint(depthsCollation, params);
      x = deepPixel.x;
      y = deepPixel.y;
      return {x, y, level, depth};
    }
    redraws = 0;
  }
  return {x, y, level: level-2, depth};
}

rimrafSync('./frames/*');
const width = 450;
const height = 300;

let target = iterativelyGeneratePixels({width: width / 3, height: height / 3});

let params = _.extend({}, target, {
  scale: Math.pow(2, -8 - target.level),
  width,
  height,
});

let startTime = Date.now();
let set = constructSet(params);

const fileName = md5(Date.now()).substr(0, 12);
renderSetToFile(set, params, `./${fileName}.gif`)
.then((frameLocation) => {
  console.log(`Outputted final frame to ${frameLocation}`);
})
.catch((err) => {
  console.error(err);
  process.exit(1);
});