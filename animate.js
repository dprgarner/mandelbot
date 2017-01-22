'use strict';

const stream = require('stream');

const _  = require('underscore');
const CombinedStream = require('combined-stream');
const Jimp = require('jimp');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;

exports.getKeyframes = function () {
  const levels = 5;
  const width = 900 / 2;
  const height = 600 / 2;

  const originX = -0.5;
  const originY = 0;
  const destX = -0.3024056703;
  const destY = 0.66221017395;

  let initialParams = {
    width,
    height,
    depth: 500,
    scale: Math.pow(2, -7),
  };

  return Promise.all(_.map(_.range(levels), (i) =>
    new Promise((resolve, reject) => {
      let depth = 500 + 100 * i;
      let scaleFactor = (1 - Math.pow(2, -i)) / (1 - Math.pow(2, -levels));
      let set = constructSet(_.extend({}, initialParams, {
        depth,
        x: originX + (destX - originX) * scaleFactor,
        y: originY + (destY - originY) * scaleFactor,
        scale: initialParams.scale * Math.pow(2, -i),
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