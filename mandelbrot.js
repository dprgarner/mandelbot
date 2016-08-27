function convergesWithin(cap, x, y) {
  // z -> z^2 + c
  // or: x_0 = x, y_0 = y, c = x_0 + iy_0
  // 
  // x_(n+1) + iy_(n+1) 
  // = (x_n + iy_n)^2 + x_0 + iy_0
  // = (x_n^2 - y_n^2 + x_0) + i(2*x_n*y_n + y_0)

  let iterX = x, iterY = y; 
  for (let i = 0; i < cap; i++) {
    newX = iterX * iterX - iterY * iterY + x;
    newY = 2 * iterX * iterY + y;
    if (newX * newX + newY * newY > 4) return i;
    iterX = newX;
    iterY = newY;
  }
  return -1;
}

module.exports = function (width, height, centerX, centerY, scale, cap) {
  // scale: how large is a pixel?
  let set = [];
  let startX = centerX - scale * width / 2;
  let startY = centerY + scale * height / 2;
  for (let y = 0; y < height; y++) {
    set[y] = [];
    for (let x = 0; x < width; x++) {
      set[y][x] = convergesWithin(cap, startX + scale * x, startY - scale * y);
    }
  }
  return set;
}