const {INSTANT} = require('./env');
const pinchColourScheme = require('./pinchColourScheme');

module.exports = function() {
  // Possibly tweet at another bot while waiting for a tweet window.
  return Promise.resolve(true)
  .then(() => (Math.random() < 0.25) ? pinchColourScheme() : true)
  .then(() => new Promise((resolve, reject) => {
    // Wait until the next twelve-hour point.
    let tweetInterval = 1000 * 60 * 60 * 12;
    let msUntilTime = tweetInterval - (Date.now() % tweetInterval);
    setTimeout(resolve, INSTANT ? 0 : msUntilTime);
  }));
}
