'use strict';

const fs = require('fs');
const stream = require('stream');
const {execFile} = require('child_process');

const _  = require('underscore');
const CombinedStream = require('combined-stream');
const GIFEncoder = require('gif-stream/encoder');
const gifsicle = require('gifsicle');
const neuquant = require('neuquant');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;

// Trajectory of the centre of the viewport: start at origin, go to
// destination, decrease down a level every time you go a fraction ('base') of
// the remaining distance to the destination. The width of the viewport at
// each level is half the width of the preceding level.

const getPositionFromLevel = (base) => (maxLevels) => (level) => {
  if (level < maxLevels - 2) {
    return (1 - Math.pow(base, - level));
  } else if (level < maxLevels - 1) {
    return 1 - Math.pow(base, 2 - maxLevels) * (maxLevels - 1 - level);
  } else {
    return 1;
  }
};


const generateFrameData = (params) => (level) => {
  const originX = -0.5;
  const originY = 0;
  const {x, y, levels} = params;
  const pos = getPositionFromLevel(3)(levels);

  return {
    level,
    scale: Math.pow(2, -7 -level),
    x: originX + (x - originX) * pos(level),
    y: originY + (y - originY) * pos(level),
    depth: 500 + Math.floor(100 * level),
  };
};

function generateKeyFrameImages(params) {
  const {x, y, levels, width, height} = params
  const frames = _.map(_.range(levels), generateFrameData({x, y, levels}));

  return Promise.all(_.map(frames, (frame, i) =>
    new Promise((resolve, reject) => {
      let set = constructSet(_.extend({}, {width, height}, frame));
      console.log(`Constructed Mandelbrot set #${i}`);

      let frameLocation = `./temp/key-${i}.gif`;
      drawMandelbrot(set, frame.depth)
      .pipe(new neuquant.Stream(width, height, {colorSpace: 'rgb'}))
      .pipe(new GIFEncoder)
      .pipe(fs.createWriteStream(frameLocation))
      .on('finish', (err) => {
        console.log(`Outputted keyFrame to ${frameLocation}`);
        if (err) {
          reject(err);
        } else {
          resolve(frameLocation);
        }
      });
    })
  ));
}

function sinusoidalInOut(k) {
  return 0.5 * (1 - Math.cos(Math.PI * k));
}

exports.getAnimatedStream = function({x, y, levels, width: gifWidth, height: gifHeight}) {
  let startTime = Date.now();

  const width = gifWidth * 2;
  const height = gifHeight * 2;

  const params = {x, y, levels, width, height};

  return generateKeyFrameImages(params)
  .then((keyFrames) => {
    const getFrameData = generateFrameData(params);

    const approxFramesPerLevel = 10; // Not sure what to call this.
    const steps = levels * approxFramesPerLevel;
    const levelsRange = _.map(_.range(0, steps), (step) => {
      return levels * sinusoidalInOut(step / steps);
    });

    return _.map(levelsRange, (level, i) => {
      let sliceFrameData = getFrameData(level);
      let keyFrameData = getFrameData(Math.floor(level));

      // Ratio of slice frame dimensions to keyFrame dimensions
      let r = sliceFrameData.scale / keyFrameData.scale;
      // Difference of centres, in pixels
      let deltaX = (sliceFrameData.x - keyFrameData.x) / keyFrameData.scale;
      let deltaY = (sliceFrameData.y - keyFrameData.y) / keyFrameData.scale;
      let left = Math.floor(deltaX + (1 - r) * width / 2);
      let top = Math.floor(- deltaY + (1 - r) * height / 2);
      let newWidth = Math.floor(r * width);
      let newHeight = Math.floor(r * height);

      return {
        frameNumber: i,
        left,
        top,
        newWidth,
        newHeight,
        keyFrame: keyFrames[Math.floor(level)],
      };
    });
  })
  .then((framesData) => Promise.all(
    _.map(framesData, ({frameNumber, left, top, newWidth, newHeight, keyFrame}) =>
      new Promise((resolve, reject) => {
        let outputFile = `./temp/${frameNumber}.gif`;
        execFile(
          gifsicle,
          [
            '--crop', `${left},${top}+${newWidth}x${newHeight}`,
            '--resize-method', 'box',
            '--resize', `${gifWidth}x${gifHeight}`,
            keyFrame,
            '-o', `${outputFile}`,
          ],
          (err) => {
            if (err) return reject(err);
            console.log(`Drawn frame ${frameNumber} after ${Date.now() - startTime}ms`);
            resolve(outputFile);
          }
        );
      })
    )
  ))
  .then((paths) => {
    return new Promise((resolve, reject) => {
      const outputFile = './temp/output.gif';
      execFile(gifsicle, [
        '-l',
        '-d6',
      ].concat(paths).concat([
        '-O',
        '-o', outputFile
      ]), (err) => {
        if (err) return reject(err);
        console.log(`Collated gif after ${Date.now() - startTime}ms`);
        resolve(outputFile);
      });
    });
  });
};
