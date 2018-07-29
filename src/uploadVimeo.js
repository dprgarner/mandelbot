const Vimeo = require('vimeo').Vimeo;
const winston = require('winston');

let client = new Vimeo(
  process.env.VIMEO_CLIENT_ID,
  process.env.VIMEO_CLIENT_SECRET,
  process.env.VIMEO_ACCESS_TOKEN
);

module.exports = (fileName) => new Promise((resolve, reject) => {
  client.streamingUpload(fileName, (err, body, statusCode, headers) => {
    if (err) return reject(err);

    client.request(headers.location, function (err, body) {
      if (err) return reject(err);
      let strippedFilename = fileName.match(/([0-9a-f]+)\.mp4/)[1];
      client.request({
        method: 'PATCH',
        path: body.uri,
        query: {
          name: 'Mandelbrot set: ' + strippedFilename,
          description: 'A zoom of the Mandelbrot set.'
        },
      }, (err) => {
        if (err) return reject(err);
        resolve(body.link)
      });
    });
  }, (uploadSize, fileSize) => {
    winston.debug(Math.round((uploadSize / fileSize) * 100) + "% uploaded");
  });
});
