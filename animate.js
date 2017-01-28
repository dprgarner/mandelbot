'use strict';

const fs = require('fs');
const stream = require('stream');
const {execFile} = require('child_process');

const _  = require('underscore');
const rimraf = require('rimraf');
const CombinedStream = require('combined-stream');
const GIFDecoder = require('gif-stream/decoder');
const GIFEncoder = require('gif-stream/encoder');
const gifsicle = require('gifsicle');
const neuquant = require('neuquant');
const PixelStream = require('pixel-stream');
const toArray = require('stream-to-array');

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
    scale: Math.pow(2, -9 - level),
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

      let frameLocation = `./frames/key-${i}.gif`;
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

function mergeGifs({ratio, path1, path2, path3, width, height}) {
  function bufferGif(filePath) {
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

  return new Promise((resolve, reject) => {
    bufferGif(path1).then((bufferA) => {
      bufferGif(path2).then((bufferB) => {
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

exports.getAnimatedStream = function({x, y, levels, width: gifWidth, height: gifHeight}) {
  let startTime = Date.now();

  const gifToRenderRatio = 4;
  const width = gifWidth * gifToRenderRatio;
  const height = gifHeight * gifToRenderRatio;

  const params = {x, y, levels, width, height};

  function takeSliceFrom(keyFrameData, sliceFrameData) {
      // Ratio of slice frame dimensions to keyFrame dimensions
      let r = sliceFrameData.scale / keyFrameData.scale;
      // Difference of centres, in pixels
      let deltaX = (sliceFrameData.x - keyFrameData.x) / keyFrameData.scale;
      let deltaY = (sliceFrameData.y - keyFrameData.y) / keyFrameData.scale;

      let left = Math.floor(deltaX + (1 - r) * width / 2);
      let top = Math.floor(- deltaY + (1 - r) * height / 2);
      let cropWidth = Math.floor(r * width);
      let cropHeight = Math.floor(r * height);

      return {left, top, cropWidth, cropHeight};
  }

  function clearTempDir() {
    return new Promise((resolve, reject) => {
      rimraf('./frames/*', (err) => {
        if (err) {
          console.log('could not remove')
          return reject(err);
        }
        resolve(true);
      });
    });
  }

  return clearTempDir()
  .then(() => generateKeyFrameImages(params))
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
        frameNumber: i,
        currentKeyFrame,
        previousKeyFrame,
      };
    });
  })
  .then((framesData) => Promise.all(
    _.map(framesData, (frameData) =>
      new Promise((resolve, reject) => {
        let {frameNumber, currentKeyFrame: {path, left, top, cropWidth, cropHeight}} = frameData;
        let outputFile = `./frames/${frameNumber}.gif`;
        execFile(
          gifsicle,
          [
            '--crop', `${left},${top}+${cropWidth}x${cropHeight}`,
            '--resize-method', 'box',
            '--resize', `${gifWidth}x${gifHeight}`,
            path,
            '-o', `${outputFile}`,
          ],
          (err) => {
            if (err) return reject(err);
            // console.log(`Drawn frame ${frameNumber} after ${Date.now() - startTime}ms`);
            resolve(outputFile);
          }
        );
      })
      .then((firstOutputFile) => new Promise((resolve, reject) => {
        if (!frameData.previousKeyFrame) return resolve({firstOutputFile});

        let {frameNumber, previousKeyFrame: {path, left, top, cropWidth, cropHeight}} = frameData;
        let outputFile = `./frames/${frameNumber}_a.gif`;

        execFile(
          gifsicle,
          [
            '--crop', `${left},${top}+${cropWidth}x${cropHeight}`,
            '--resize-method', 'catrom',
            '--resize', `${gifWidth}x${gifHeight}`,
            path,
            '-o', `${outputFile}`,
          ],
          (err) => {
            if (err) return reject(err);
            const fade = 1 - gifToRenderRatio * (cropWidth / width - 1 / gifToRenderRatio);
            resolve({firstOutputFile, secondOutputFile: outputFile, fade});
          }
        );
      }))
      .then(({firstOutputFile, secondOutputFile, fade}) => {
        if (!secondOutputFile) return firstOutputFile;
        return mergeGifs({
          width: gifWidth,
          height: gifHeight,
          ratio: fade,
          path1: firstOutputFile,
          path2: secondOutputFile,
          path3: firstOutputFile,
        });
      })
    )
  ))
  .then((paths) => {
    return new Promise((resolve, reject) => {
      const outputFile = './output.gif';
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
  })
};
