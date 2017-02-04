const rp = require('request-promise');

const {client_id, client_secret} = require('./auth').gfycatAuth;

let tokenRequest = {
  uri: 'https://api.gfycat.com/v1/oauth/token',
  json: true,
  method: 'POST',
  body: {
    client_id,
    client_secret,
    grant_type: 'client_credentials',
  },
};

rp(tokenRequest)
.then((body) => body.access_token)
.then((token) => console.log('token:', token))
.catch(function (err) {
  console.error(err);
});