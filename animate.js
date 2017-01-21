const _  = require('underscore');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;

exports.getKeyframes = function () {
  const levels = 3;
  const width = 450;
  const height = 300;
  let initialParams = {
    width,
    height,
    x: -0.3024056703,
    y: 0.66221017395,
    depth: 500,
    scale: Math.pow(2, -8),
  };

  return Promise.all(_.map(_.range(levels), (i) =>
    new Promise((resolve, reject) => {
      let depth = 500 + 100 * i;
      let set = constructSet(_.extend({}, initialParams, {
        depth,
        scale: Math.pow(2, -(8 + i)),
      }));

      drawMandelbrot(set, depth, function (err, image) {
        if (err) return reject(err);
        console.log(`Rendered image ${i}`);
        return resolve(image);
      });
    })
  ));
};
