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
}
const getWidthFromLevel = (level) => Math.pow(2, -level);

exports.generatePath = function (params) {
  const originX = -0.5;
  const originY = 0;
  const destX = params.x;
  const destY = params.y;
  const levels = params.levels;

  const pos = getPositionFromLevel(3)(levels);
  let frameData = [];
  for (var i = 0; i <= levels; i++) {
    frameData.push({
      x: originX + (destX - originX) * pos(i),
      y: originY + (destY - originY) * pos(i),
      scale: Math.pow(2, -7) * getWidthFromLevel(i),
      depth: 500 + 100 * i,
    });
  }
  return frameData;
}

exports.getKeyframes = function () {
  const levels = 21;
  const width = 900 / 2;
  const height = 600 / 2;

  const originX = -0.5;
  const originY = 0;
  const destX = -0.30240590;
  const destY =  0.66221035;

  let initialParams = {width, height};

  let keyframes = exports.generatePath({x: destX, y: destY, levels});

  return Promise.all(_.map(keyframes, ({x, y, scale, depth}, i) =>
    new Promise((resolve, reject) => {
      let set = constructSet(_.extend({}, initialParams, {
        depth, x, y, scale
      }));

      drawMandelbrot(set, depth, function (err, image) {
        if (err) return reject(err);
        console.log(`Rendered image ${i}`);
        return resolve(image);
      });
    })
  ));
};

exports.getAnimatedStream = function () {
  let startTime = Date.now();

  return exports.getKeyframes().then((keyframes) => {
    let width = keyframes[0].bitmap.width;
    let height = keyframes[0].bitmap.height;
    let gifWidth = width / 2;
    let gifHeight = height / 2;

    let combined = CombinedStream.create();
    function appendFrame(frame) {
      let s = new stream.PassThrough();
      s.end(frame.bitmap.data);
      combined.append(s);
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
    return {stream: combined, width: gifWidth, height: gifHeight};
  });
}