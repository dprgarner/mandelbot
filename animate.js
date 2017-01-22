const _  = require('underscore');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;

exports.getKeyframes = function () {
  const levels = 22;
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
