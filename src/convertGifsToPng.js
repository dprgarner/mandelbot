const fs = require('fs');
const Jimp = require('jimp');

module.exports = (gifs) => Promise.all(gifs.map(
  (gifPath, i) => Jimp.read(gifPath)
    .then((gif) => new Promise((resolve, reject) => {
      const filePath = gifPath.replace(/[^/]*\.gif$/, `thumb-${i}.png`);

      gif.write(filePath, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve(filePath);
        }
      })
    }))
));
