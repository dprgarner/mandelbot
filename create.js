const getAnimatedStream = require('./animate').getAnimatedStream;
const find = require('./find');

const width = 450;
const height = 300;

let startTime = Date.now();
let params = find({width, height});
console.log(`Found point after ${Math.round((Date.now() - startTime) / 1000)}s`);

getAnimatedStream(params)
.then((outputFile) => {
  let seconds = Math.round((Date.now() - startTime) / 1000);
  console.log(`${outputFile} completed after ${seconds}s`);
})
.catch((err) => {
  console.error(err);
  console.error(`Errored after ${Date.now() - startTime}ms`);
  process.exit(1);
});