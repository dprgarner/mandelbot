'use strict';

const stream = require('stream');

const _  = require('underscore');
const CombinedStream = require('combined-stream');
const Jimp = require('jimp');

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

function generateKeyframeImages(params) {
  const {x, y, levels, width, height} = params

  const getFrameData = generateFrameData({x, y, levels});
  const frames = _.map(_.range(levels), getFrameData);

  return Promise.all(_.map(frames, (frame, i) => {
    let set = constructSet(_.extend({}, {width, height}, frame));
    console.log(`Constructed Mandelbrot set #${i}`)
    return drawMandelbrot(set, frame.depth)
  }));
};

exports.getAnimatedStream = function () {
  let startTime = Date.now();

  const width = 900 / 2;
  const height = 600 / 2;
  const levels = 4;

  const params = {
    x: -0.30240590,
    y:  0.66221035,
    levels,
    width,
    height,
  };

  return generateKeyframeImages(params).then((keyframes) => {
    const gifWidth = width / 2;
    const gifHeight = height / 2;
    let combinedStream = CombinedStream.create();

    function appendFrame(frame) {
      let s = new stream.PassThrough();
      s.end(frame.bitmap.data);
      combinedStream.append(s);
    }

    let frames = [];
    const getFrameData = generateFrameData(params);
    for (let level = 0; level < levels; level += 0.25) {
      let sliceFrameData = getFrameData(level);
      let keyFrameData = getFrameData(Math.floor(level));
      let keyFrame = keyframes[Math.floor(level)];
      console.log(sliceFrameData); // x, y, scale, depth

      // TOOD: Figure out howmuch of keyFrame should be sliced by looking at
      // sliceFrameData and keyFrameData - there should be enough info, together with width.
      // Crop, resize, and append this image.
    }

    const framesPerLevel = 1;
    const power = Math.exp(Math.log(2) / framesPerLevel);

    _.each(keyframes, (baseImage, i) => {
      _.each(_.range(framesPerLevel), (j) => {
        let scaledImage = baseImage.clone();
        let newWidth = width * Math.pow(power, -j);
        let newHeight = height * Math.pow(power, -j);

        scaledImage.crop(
          width / 2 - newWidth / 2,
          height / 2 - newHeight / 2,
          newWidth,
          newHeight
        );
        // scaledImage.resize(gifWidth, Jimp.AUTO, Jimp.RESIZE_BEZIER);
        scaledImage.resize(gifWidth, Jimp.AUTO, Jimp.RESIZE_NEAREST_NEIGHBOR);
        appendFrame(scaledImage);
        console.log(`Drawn frame ${i},${j} after ${Date.now() - startTime}ms`);
      });
    });
    return {stream: combinedStream, width: gifWidth, height: gifHeight};
  });
};
