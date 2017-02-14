const fs = require('fs');
const rp = require('request-promise');
const winston = require('winston');

const gfycatAuth = require('./auth').gfycatAuth;

module.exports = function(filePath, title) {
  return rp({
    uri: 'https://api.gfycat.com/v1/oauth/token',
    json: true,
    method: 'POST',
    body: gfycatAuth,
  })
  .then((body) => body.access_token)
  .then((token) => {
    const headers = {Authorization: token};
    winston.debug('Token:', token);
    return rp({
      uri: 'https://api.gfycat.com/v1/gfycats',
      json: true,
      method: 'POST',
      headers,
      body: {title},
    })
    .then(({gfyname, secret}) => {
      winston.debug({gfyname, secret});

      return rp({
        uri: 'https://filedrop.gfycat.com',
        json: true,
        method: 'POST',
        formData: {
          key: gfyname,
          file: fs.createReadStream(filePath),
        },
      })
      .then(() => `https://giant.gfycat.com/${gfyname}.gif`)
      .catch((err) => reject(err))
    });
  });
}
