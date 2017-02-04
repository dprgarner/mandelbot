const _ = require('underscore');

const constructSet = require('./mandelbrot').constructSet;

function collateDepths(set, {width, height, depth}) {
  let depthsCollation = {[null]: []};
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let depth = set[y][x];
      if (!depthsCollation[depth]) depthsCollation[depth] = [];
      depthsCollation[depth].push({x, y});
    }
  }

  for (let i = 0; i < depth; i++) {
    if (depthsCollation[i]) depthsCollation.maxDepth = i;
  }
  return depthsCollation;
}

function toComplexCoords({pixelX, pixelY}, {x, y, width, height, scale}) {
  // Convert back to complex coordinates
  let newX = x + (pixelX - width / 2) * scale;
  let newY = y - (pixelY - height / 2) * scale;
  return {x: newX, y: newY}; 
}

function getRandomNearMandelbrotPoint(
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

function getRandomMandelbrotPoint(
  depthsCollation, {x, y, width, height, depth, scale}
) {
  let {x: pixelX, y: pixelY} = depthsCollation[null][
    Math.floor(Math.random() * depthsCollation[null].length)
  ];
  return toComplexCoords({pixelX, pixelY}, {x, y, width, height, scale});
}

function render(set, params, fileName) {
  renderSetToFile(set, params, fileName)
  .then((frameLocation) => {
    console.log(`Outputted keyFrame to ${frameLocation}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

// Split the set into 10x10-pixel segments, count the proportion of points
// which are in the Mandelbrot set, and return these proportions as a matrix.
function getPercentProfile(set) {
  const xSize = 10;
  const ySize = 10;
  const yRange = Math.floor(set.length / ySize);
  const xRange = Math.floor(set[0].length / xSize);
  let profile = [];

  for (let y = 0; y < yRange; y++) {
    profile[y] = [];
    for (let x = 0; x < xRange; x++) {
      let mandelbrotCount = 0;
      for (let j = 0; j < ySize; j++) {
        for (let i = 0; i < xSize; i++) {
          if (set[ySize * y + j][xSize * x + i] === null) {
            mandelbrotCount++;
          }
        }
      }
      profile[y][x] = mandelbrotCount / (xSize * ySize);
    }
  }
  return profile;
}

// A reduce function for the profile set.
function reduceProfile(profile, init, fn) {
  const yRange = profile.length;
  const xRange = profile[0].length;

  let acc = init;
  for (let j = 0; j < yRange; j++) {
    for (let i = 0; i < xRange; i++) {
      acc = fn(acc, profile[j][i]);
    }
  }
  return acc;
}

const getMaxProportion = (profile) => reduceProfile(profile, 0, Math.max);

function getMaxProportionArea(profile) {
  let max = getMaxProportion(profile);

  const yRange = profile.length;
  const xRange = profile[0].length;

  // Find the areas which have the highest proportion of Mandelbrot points.
  let areas = [];
  for (let j = 0; j < yRange; j++) {
    for (let i = 0; i < xRange; i++) {
      if (profile[j][i] === max) {
        areas.push([j, i]);
      }
    }
  }

  // When there are multiple maximal areas, we find and return the one with the
  // greatest sum of its neighbours.
  function sumNeighbours([j, i]) {
    sum = 0;
    if (j > 0) sum += profile[j-1][i];
    if (j < yRange - 1) sum += profile[j+1][i];
    if (i > 0) sum += profile[j][i-1];
    if (i < xRange - 1) sum += profile[j][i+1];
    return sum;
  }

  let maxArea;
  if (areas.length === 1) {
    maxArea = areas[0];
  } else {
    let neighbourAreas = areas.map(sumNeighbours);
    maxArea = areas[neighbourAreas.indexOf(Math.max(...neighbourAreas))];
  }

  return {y: (maxArea[0] + 0.5) / yRange, x: (maxArea[1] + 0.5) / xRange};
}

function lotsOfGrainyAreas(profile) {
  let proportion = reduceProfile(profile, 0, (acc, p) => 
    acc += (p > 0 && p < 0.5) ? 1 : 0
  );
  return proportion / (profile.length * profile[0].length) > 0.25;
}

function lotsOfNotMandlebrotAreas(profile) {
  let proportion = reduceProfile(profile, 0, (acc, p) => 
    acc += (p === 0) ? 1 : 0
  );
  return proportion / (profile.length * profile[0].length) > 0.25;
}

const totalProportion = (profile) => (
  reduceProfile(profile, 0, (acc, p) => acc + p) / (profile.length * profile[0].length)
);

// Find which sides of the image have a non-trivial proportion of Mandelbrot
// set points.
function getMandelbrotSides(set) {
  const yRange = set.length;
  const xRange = set[0].length;

  let sides = {
    N: set[0],
    S: set[yRange - 1],
    E: set.map(arr => arr[xRange - 1]),
    W: set.map(arr => arr[0]),
  }

  return _.chain(sides)
  .pick((side) => side.filter(p => p === null).length / side.length > 0.1)
  .keys()
  .value();
}

// For logging.
let attempt = -1;
function scry({width, height}) {
  let depthAdjust = 500;

  let x = -0.5;
  let y = 0;

  const targetLevel = 16 + Math.round(Math.random() * 4);
  let level;
  let depth;
  let scale;

  // Initial scry: get to a reasonably deep spot.
  for (level = 0; level < targetLevel; level += 4) {
    attempt++; // Logging
    depth = depthAdjust + 100 * level;
    scale = Math.pow(2, -6 - level); // (size in complex coords) / (size in pixels)
    let params = {scale, x, y, depth, width, height, level};

    let set = constructSet(params);
    // Logging
    console.log(`    ${attempt}: Level: ${level}, Depth: ${depth}`);

    let depthsCollation = collateDepths(set, {width, height, depth});
    let threshold = Math.floor(
      (0.1 * Math.random()) * (width * height - depthsCollation[null].length)
    );

    if (depthsCollation.maxDepth < depth / 2) {
      console.log('Depth unnecessarily high: adjusting...') 
      depthAdjust = Math.round(depthAdjust / 2);
    }

    let deepPixel = getRandomNearMandelbrotPoint(depthsCollation, params, threshold);
    x = deepPixel.x;
    y = deepPixel.y;
  }

  // Final traversal: try and hone in on a Mandelbrot point.
  // Five tries.
  let tries = 5;
  let potentials = [];

  for (let j = 0; j < tries; j++) {
    attempt++; // Logging
    depth = depthAdjust + 100 * level;
    scale = Math.pow(2, -6 - level); // (size in complex coords) / (size in pixels)
    let params = {scale, x, y, depth, width, height, level};

    let set = constructSet(params);
    // Logging
    console.log(`      ${attempt}: Level: ${level}, Depth: ${depth}`);

    let profile = getPercentProfile(set);
    let maxProportion = getMaxProportion(profile);

    // Stop if there are no likely candidates for a Mandelbrot copy
    if (getMaxProportion(profile) === 0) {
      console.log('Nothing here');
      level--;
      continue;
    }

    // Stop if it's too grainy
    if (lotsOfGrainyAreas(profile)) {
      console.log('Too much noise - adding depth adjust');
      depthAdjust += 100;
      level--;
      continue;
    }

    // Stop if there aren't clear areas 
    if (!lotsOfNotMandlebrotAreas(profile)) {
      console.log('Not enough clear space');
      level--;
      continue;
    }

    // Find which sides of the image have Mandelbrot sets
    let sides = getMandelbrotSides(set);
    if (sides.length > 2) {
      console.log('Totally surrounded');
      level--;
      continue;
    } else if (sides.length > 0) {
      // Adjust focus point to keep the Mandelbrot in the centre.
      console.log('Adjusting focus');
      let pixelX = width / 2;
      let pixelY = height / 2;

      if (sides.indexOf('N') !== -1) pixelY = 0;
      if (sides.indexOf('S') !== -1) pixelY = height;
      if (sides.indexOf('E') !== -1) pixelX = width;
      if (sides.indexOf('W') !== -1) pixelX = 0;

      let newPoint = toComplexCoords({pixelX, pixelY}, {x, y, width, height, scale});
      x = newPoint.x;
      y = newPoint.y;

      // Do not zoom out
      continue;
    }

    // If there is a solid area of Mandelbrot points, then this is an
    // acceptable area to use. It might be improved upon, though.
    if (getMaxProportion(profile) > 0.8) {
      potentials.push({x, y, level, depth});
    }

    // Focus on the densest proportion of Mandelbrot points.
    let focusArea = getMaxProportionArea(profile);
    let newPixel = {pixelX: focusArea.x * width, pixelY: focusArea.y * height};
    let newPoint = toComplexCoords(newPixel, {x, y, width, height, scale});
    x = newPoint.x;
    y = newPoint.y;

    // Zoom in some more if there's not enough Mandelbrot points.
    let proportion = totalProportion(profile);
    if (proportion < 0.05) {
      console.log('Zooming in');
      level++;
      tries++; // An extra try, to get the right zoom.
    }
  }

  if (potentials.length) return potentials[potentials.length - 1];
}

module.exports = function ({width, height}) {
  let target;

  while (!target) {
    target = scry({width: width / 3, height: height / 3});
  }
  console.log(`Found a mandelbrot copy after ${attempt} attempts`);

  let params = _.extend({}, target, {
    scale: Math.pow(2, -8 - target.level),
    width,
    height,
    levels: target.level,
  });

  return params;
}