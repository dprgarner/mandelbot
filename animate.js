'use strict';

const fs = require('fs');
const stream = require('stream');
const {execFileSync} = require('child_process');

const _  = require('underscore');
const CombinedStream = require('combined-stream');
const GIFDecoder = require('gif-stream/decoder');
const GIFEncoder = require('gif-stream/encoder');
const md5 = require('md5');
const neuquant = require('neuquant');
const PixelStream = require('pixel-stream');
const rimraf = require('rimraf');
const toArray = require('stream-to-array');

const constructSet = require('./mandelbrot').constructSet;
const drawMandelbrot = require('./mandelbrot').drawMandelbrot;
const randomColours = require('./mandelbrot').randomColours;
const renderSetToFile = require('./mandelbrot').renderSetToFile;

const {OUTPUT_DIR, TEST, DOCKER} = require('./env');
const ffmpeg = DOCKER ? './node_modules/.bin/ffmpeg' : 'node_modules\\.bin\\ffmpeg.cmd';
const gifsicle = exports.gifsicle = DOCKER ? '/usr/bin/gifsicle' : require('gifsicle');

// Input: list of promise *generators*.
// Output: promise which resolves promises one-at-a-time in sequence, which
// eventually resolves to the list of all promise results (like Promise.all),
// or returns the first Promise reject.
const serial = funcs => funcs.reduce(
  (promise, func) => promise.then(result =>
    func().then(Array.prototype.concat.bind(result))
  ),
  Promise.resolve([])
);

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
    scale: Math.pow(2, -8 - level + (TEST ? 2 : 0)),
    x: originX + (x - originX) * pos(level),
    y: originY + (y - originY) * pos(level),
    depth: 500 + Math.floor(100 * level),
  };
};

function generateKeyFrameImages(params) {
  const {x, y, levels, width, height} = params;
  const frames = _.map(_.range(levels), generateFrameData({x, y, levels}));

  return serial(_.map(frames, (frame, i) => () => {
    let startTime = Date.now();
    console.log(`Constructing Mandelbrot set #${i}...`);
    let set = constructSet(_.extend({}, {width, height}, frame));
    console.log(`Constructed Mandelbrot set #${i} after ${Date.now() - startTime}ms`);

    return renderSetToFile(
      set,
      _.extend(params, {depth: frame.depth}),
      `./frames/key-${i}.gif`
    );
  }));
}

exports.bufferGif = function(filePath) {
  return toArray(
    fs.createReadStream(filePath).pipe(new GIFDecoder)
  )
  .then((parts) => {
    var buffers = []
    for (var i = 0, l = parts.length; i < l ; ++i) {
      var part = parts[i]
      buffers.push((part instanceof Buffer) ? part : new Buffer(part))
    }
    return Buffer.concat(buffers)
  });
}

function mergeGifs({ratio, path1, path2, path3, width, height}) {
  return new Promise((resolve, reject) => {
    exports.bufferGif(path1).then((bufferA) => {
      exports.bufferGif(path2).then((bufferB) => {
        const s = new PixelStream(width, height, {colorSpace: 'rgb'});
        const ratioBar = 1 - ratio;

        let bufferC = Buffer.alloc(bufferA.length)
        for (let i = 0; i < bufferB.length; i++) {
          bufferC[i] = Math.floor(bufferA[i] * ratio + bufferB[i] * ratioBar);
        }
        s.push(bufferC);
        s.end();

        s.pipe(new neuquant.Stream(width, height, {colorSpace: 'rgb'}))
        .pipe(new GIFEncoder)
        .pipe(fs.createWriteStream(path3))
        .on('finish', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(path3);
          }
        });
      });
    });
  })
}

function sinusoidalInOut(k) {
  return 0.5 * (1 - Math.cos(Math.PI * k));
}

function padWithZeroes(i) {
  if (i < 10) return '00' + i;
  if (i < 100) return '0' + i;
  return '' + i;
}

exports.createFrames = function({x, y, levels, width: gifWidth, height: gifHeight}) {
  let startTime = Date.now();

  const width = 4 * gifWidth;
  const height = 4 * gifHeight;
  const colours = randomColours();

  const params = {x, y, levels, width, height, colours};

  function takeSliceFrom(keyFrameData, sliceFrameData) {
      // Ratio of slice frame dimensions to keyFrame dimensions
      let r = sliceFrameData.scale / keyFrameData.scale;
      // Difference of centres, in pixels
      let deltaX = (sliceFrameData.x - keyFrameData.x) / keyFrameData.scale;
      let deltaY = (sliceFrameData.y - keyFrameData.y) / keyFrameData.scale;

      let left = Math.max(0, Math.floor(deltaX + (1 - r) * width / 2));
      let top = Math.max(0, Math.floor(- deltaY + (1 - r) * height / 2));
      let cropWidth = Math.floor(r * width);
      let cropHeight = Math.floor(r * height);

      return {left, top, cropWidth, cropHeight};
  }

  if (!fs.existsSync('./frames')) fs.mkdirSync('./frames');
  rimraf.sync('./frames/*');

  let ticker = 0;
  return generateKeyFrameImages(params)
  .then((keyFrames) => {
    const getFrameData = generateFrameData(params);

    const approxFramesPerLevel = 10; // Not sure what to call this.
    const steps = levels * approxFramesPerLevel;
    const levelsRange = _.map(_.range(0, steps), (step) => {
      return levels * sinusoidalInOut(step / steps);
    });

    return _.map(levelsRange, (level, i) => {
      let currentKeyFrameLevel = Math.floor(level);
      let previousKeyFrameLevel = currentKeyFrameLevel - 1;
      let sliceFrameData = getFrameData(level);

      let currentKeyFrame = _.extend(
        {},
        {path: keyFrames[currentKeyFrameLevel]},
        takeSliceFrom(getFrameData(currentKeyFrameLevel), sliceFrameData)
      );

      let previousKeyFrame = previousKeyFrameLevel > -1 ? _.extend(
        {},
        {path: keyFrames[previousKeyFrameLevel]},
        takeSliceFrom(getFrameData(previousKeyFrameLevel), sliceFrameData)
      ) : null;

      return {
        frameNumber: padWithZeroes(i),
        currentKeyFrame,
        previousKeyFrame,
      };
    });
  })
  .then((framesData) => serial(
    _.map(framesData, (frameData) => () => {
      let {frameNumber, currentKeyFrame: {path, left, top, cropWidth, cropHeight}} = frameData;
      console.log(`Frame ${frameNumber} of ${framesData.length}...`)
      let outputFile1 = `./frames/${frameNumber}.gif`;
      execFileSync(
        gifsicle,
        [
          '--crop', `${left},${top}+${cropWidth}x${cropHeight}`,
          '--resize-method', 'box',
          '--resize', `${gifWidth}x${gifHeight}`,
          path,
          '-o', `${outputFile1}`,
        ]
      );

      if (!frameData.previousKeyFrame) {
        return Promise.resolve(outputFile1);
      }

      let prev = frameData.previousKeyFrame;
      let outputFile2 = `./frames/${frameNumber}_a.gif`;

      execFileSync(
        gifsicle,
        [
          '--crop', `${prev.left},${prev.top}+${prev.cropWidth}x${prev.cropHeight}`,
          '--resize-method', 'catrom',
          '--resize', `${gifWidth}x${gifHeight}`,
          prev.path,
          '-o', `${outputFile2}`,
        ]
      );
      const fade = Math.min(1, Math.max(0, 1 - 2 * (cropWidth / width - 0.5)));
      let outputFile3 = `./frames/${frameNumber}_b.gif`;

      return mergeGifs({
        width: gifWidth,
        height: gifHeight,
        ratio: fade,
        path1: outputFile1,
        path2: outputFile2,
        path3: outputFile3,
      });
    })
  ));
};

exports.createGif = function(params) {
  let startTime = Date.now();
  return exports.createFrames(params)
  .then((paths) => {
    const fileName = md5(Date.now()).substr(0, 12);
    const outputFile = `${OUTPUT_DIR}/${fileName}.gif`;
    execFileSync(
      gifsicle,
      [
        '-l',
        '-d6',
      ].concat(paths).concat([
        '-O',
        '-o', outputFile
      ])
    );
    console.log(`Collated gif after ${Date.now() - startTime}ms`);
    return outputFile;
  });
};

exports.createMp4 = function(params) {
  let startTime = Date.now();
  return exports.createFrames(params)
  .then((paths) => {
    const concatFile = './concat.txt';
    const fileName = md5(Date.now()).substr(0, 12);
    const outputFile = `${OUTPUT_DIR}/${fileName}.mp4`;

    fs.writeFileSync(concatFile, _.flatten(_.map(paths, (path) => [
      `file '${path}'`,
      'duration 0.06',
    ])).join('\n'));

    execFileSync(
      ffmpeg,
      [
        '-safe', '0',
        '-y',
        '-f', 'concat',
        '-i', concatFile,
        '-vf', 'format=yuv420p',
        '-preset', 'veryslow',
        '-crf', '0',
        outputFile,
      ]
    );

    console.log(`Collated mp4 after ${Date.now() - startTime}ms`);
    return outputFile;
  });
};