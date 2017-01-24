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
    return drawMandelbrot(set, frame.depth);
  }));
};

exports.getAnimatedStream = function({x, y, levels, width: gifWidth, height: gifHeight}) {
  let startTime = Date.now();

  const width = gifWidth * 2;
  const height = gifHeight * 2;

  const params = {x, y, levels, width, height};

  return generateKeyframeImages(params).then((keyframes) => {
    let combinedStream = CombinedStream.create();

    function appendFrame(frame) {
      let s = new stream.PassThrough();
      s.end(frame.bitmap.data);
      combinedStream.append(s);
    }

    const getFrameData = generateFrameData(params);
    let i = 0;
    for (let level = 0; level < levels; level += 0.25) {
      let sliceFrameData = getFrameData(level);
      let keyFrameData = getFrameData(Math.floor(level));
      let keyFrame = keyframes[Math.floor(level)];

      // Ratio of slice frame dimensions to keyframe dimensions
      let r = sliceFrameData.scale / keyFrameData.scale;
      // Difference of centres, in pixels
      let deltaX = (sliceFrameData.x - keyFrameData.x) / keyFrameData.scale;
      let deltaY = (sliceFrameData.y - keyFrameData.y) / keyFrameData.scale;
      let left = Math.floor(deltaX + (1 - r) * width / 2);
      let top = Math.floor(- deltaY + (1 - r) * height / 2);

      let scaledImage = keyFrame.clone();
      scaledImage.crop(left, top, width * r, height * r);
      // scaledImage.resize(gifWidth, Jimp.AUTO, Jimp.RESIZE_BEZIER);
      scaledImage.resize(gifWidth, Jimp.AUTO, Jimp.RESIZE_NEAREST_NEIGHBOR);
      appendFrame(scaledImage);
      console.log(`Drawn frame ${i++} at level ${Math.floor(level)} after ${Date.now() - startTime}ms`);
    }

    return combinedStream;
  });
};
