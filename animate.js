const _  = require('underscore');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;

exports.getKeyframes = function () {
  const levels = 21;
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

  // let params = {
  //   width: 450,
  //   height: 300,
  //   // x: 0.5,
  //   // y: 0,
  //   x: -0.64,
  //   y: 0.45,
  //   depth: 500,
  //   scale: 1 / Math.pow(2, 14),
  // };

  // let startTime = Date.now();
  // let set = constructSet(_.extend({}, params, {
  //   width: params.width * 4,
  //   height: params.height * 4,
  // }));
  // console.log(`Set constructed after ${Date.now() - startTime}ms`);

  // drawMandelbrot(set, params.depth, function (err, image) {
  //   if (err) return console.error(err);
  //   let set2 = constructSet(_.extend({}, params, {
  //     scale: params.scale / 2,
  //     depth: 1000,
  //   }));

  //   console.log(`Drawn base images after ${Date.now() - startTime}ms`);
  //   // image2.invert();
  //   let combined = CombinedStream.create();

  //   const framesPerLevel = 15;
  //   const power = Math.exp(Math.log(2) / framesPerLevel);

  //   for (var i = 0; i < framesPerLevel; i++) {
  //     let scaledImage = image.clone();
  //     let newWidth = Math.floor(params.width * Math.pow(power, i));
  //     let newHeight = Math.floor(params.height * Math.pow(power, i));
  //     // Jimp.RESIZE_BEZIER Looks better, but is really slow.
  //     scaledImage.resize(newWidth, Jimp.AUTO, Jimp.RESIZE_NEAREST_NEIGHBOR);
  //     scaledImage.crop(
  //       (newWidth - params.width) / 2,
  //       (newHeight - params.height) / 2,
  //       params.width,
  //       params.height
  //     );

  //     let s = new stream.PassThrough();
  //     s.end(scaledImage.bitmap.data);
  //     combined.append(s);
  //     console.log(`Drawn frame ${i} after ${Date.now() - startTime}ms`);
  //   }

  //   res.writeHead(200, {'Content-Type': 'image/gif'});
  //   let encoder = new GIFEncoder(params.width, params.height);

  //   combined.pipe(encoder.createWriteStream({repeat: 0, delay: 0}))
  //   .pipe(res)
  //   .on('finish', function () {
  //     console.log(`Rendered after ${Date.now() - startTime}ms`);
  //   });
  // });