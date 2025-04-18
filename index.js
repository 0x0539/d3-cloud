// Modified d3-cloud library with incremental placement and dead zone support
// Word cloud layout by Jason Davies, https://www.jasondavies.com/wordcloud/
// Algorithm due to Jonathan Feinberg, https://s3.amazonaws.com/static.mrfeinberg.com/bv_ch03.pdf

const dispatch = require("d3-dispatch").dispatch;

const RADIANS = Math.PI / 180;

const SPIRALS = {
  archimedean: archimedeanSpiral,
  rectangular: rectangularSpiral
};

const cw = 1 << 11 >> 5;
const ch = 1 << 11;

module.exports = function() {
  var size = [256, 256],
      text = cloudText,
      font = cloudFont,
      fontSize = cloudFontSize,
      fontStyle = cloudFontNormal,
      fontWeight = cloudFontNormal,
      rotate = cloudRotate,
      padding = cloudPadding,
      spiral = archimedeanSpiral,
      words = [],
      timeInterval = Infinity,
      event = dispatch("word", "end"),
      timer = null,
      random = Math.random,
      cloud = {},
      canvas = cloudCanvas,
      // Store persistent state for incremental updates
      board = null,
      bounds = null,
      existingTags = [],
      // Dead zones where words should not be placed
      deadZones = [];

  cloud.canvas = function(_) {
    return arguments.length ? (canvas = functor(_), cloud) : canvas;
  };

  cloud.start = function(incremental) {
    var contextAndRatio = getContext(canvas());
    
    // Initialize or reuse the board
    if (!incremental || board === null) {
      board = zeroArray((size[0] >> 5) * size[1]);
      bounds = null;
      existingTags = [];
    }
    
    var n = words.length,
        i = -1,
        tags = incremental ? existingTags.slice() : [],
        newWords = incremental ? 
          words.filter(word => !existingTags.some(tag => tag.text === word.text)) : 
          words.slice();
    
    // Process all words (both existing and new)
    var data = newWords.map(function(d, i) {
      d.text = text.call(this, d, i);
      d.font = font.call(this, d, i);
      d.style = fontStyle.call(this, d, i);
      d.weight = fontWeight.call(this, d, i);
      d.rotate = rotate.call(this, d, i);
      d.size = ~~fontSize.call(this, d, i);
      d.padding = padding.call(this, d, i);
      return d;
    }).sort(function(a, b) { return b.size - a.size; });

    if (timer) clearInterval(timer);
    timer = setInterval(step, 0);
    step();

    return cloud;

    function step() {
      var start = Date.now();
      while (Date.now() - start < timeInterval && ++i < data.length && timer) {
        var d = data[i];
        d.x = (size[0] * (random() + .5)) >> 1;
        d.y = (size[1] * (random() + .5)) >> 1;
        cloudSprite(contextAndRatio, d, data, i);
        if (d.hasText && place(board, d, bounds)) {
          tags.push(d);
          event.call("word", cloud, d);
          if (bounds) cloudBounds(bounds, d);
          else bounds = [{x: d.x + d.x0, y: d.y + d.y0}, {x: d.x + d.x1, y: d.y + d.y1}];
          // Temporary hack
          d.x -= size[0] >> 1;
          d.y -= size[1] >> 1;
        }
      }
      if (i >= data.length) {
        // Save the current state for future incremental updates
        existingTags = tags.slice();
        
        cloud.stop();
        event.call("end", cloud, tags, bounds);
      }
    }
  };

  cloud.stop = function() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    return cloud;
  };

  // New method to clear all state and start fresh
  cloud.reset = function() {
    board = null;
    bounds = null;
    existingTags = [];
    return cloud;
  };

  // New method to add dead zones
  cloud.addDeadZone = function(x, y, width, height) {
    deadZones.push({
      x1: x,
      y1: y,
      x2: x + width,
      y2: y + height
    });
    return cloud;
  };

  // New method to clear all dead zones
  cloud.clearDeadZones = function() {
    deadZones = [];
    return cloud;
  };

  // New method to get all dead zones
  cloud.getDeadZones = function() {
    return deadZones.slice();
  };

  function getContext(canvas) {
    const context = canvas.getContext("2d", {willReadFrequently: true});

    canvas.width = canvas.height = 1;
    const ratio = Math.sqrt(context.getImageData(0, 0, 1, 1).data.length >> 2);
    canvas.width = (cw << 5) / ratio;
    canvas.height = ch / ratio;

    context.fillStyle = context.strokeStyle = "red";

    return {context, ratio};
  }

  // Check if a tag overlaps with any dead zone
  function intersectsDeadZone(tag) {
    // Calculate the actual tag bounds with rotation considered
    var tagLeft = tag.x + tag.x0;
    var tagRight = tag.x + tag.x1;
    var tagTop = tag.y + tag.y0;
    var tagBottom = tag.y + tag.y1;

    // If tag is rotated, we use a more conservative bounding box
    // This isn't perfect for rotated text but works as a first approximation
    if (tag.rotate) {
      // Expand the bounding box to account for rotation
      var diagonal = Math.sqrt(
        Math.pow(tagRight - tagLeft, 2) + 
        Math.pow(tagBottom - tagTop, 2)
      ) / 2;
      
      var centerX = (tagLeft + tagRight) / 2;
      var centerY = (tagTop + tagBottom) / 2;
      
      tagLeft = centerX - diagonal;
      tagRight = centerX + diagonal;
      tagTop = centerY - diagonal;
      tagBottom = centerY + diagonal;
    }

    // Check against each dead zone
    for (var i = 0; i < deadZones.length; i++) {
      var zone = deadZones[i];
      
      // Standard rectangle intersection test
      if (!(tagRight < zone.x1 || tagLeft > zone.x2 || 
            tagBottom < zone.y1 || tagTop > zone.y2)) {
        return true;
      }
    }
    
    return false;
  }

  function place(board, tag, bounds) {
    var perimeter = [{x: 0, y: 0}, {x: size[0], y: size[1]}],
        startX = tag.x,
        startY = tag.y,
        maxDelta = Math.sqrt(size[0] * size[0] + size[1] * size[1]),
        s = spiral(size),
        dt = random() < .5 ? 1 : -1,
        t = -dt,
        dxdy,
        dx,
        dy;

    while (dxdy = s(t += dt)) {
      dx = ~~dxdy[0];
      dy = ~~dxdy[1];

      if (Math.min(Math.abs(dx), Math.abs(dy)) >= maxDelta) break;

      tag.x = startX + dx;
      tag.y = startY + dy;

      if (tag.x + tag.x0 < 0 || tag.y + tag.y0 < 0 ||
          tag.x + tag.x1 > size[0] || tag.y + tag.y1 > size[1]) continue;
      
      // Check if the tag intersects with any dead zone
      if (intersectsDeadZone(tag)) continue;
      
      // TODO only check for collisions within current bounds.
      if (!bounds || collideRects(tag, bounds)) {
        if (!cloudCollide(tag, board, size[0])) {
          var sprite = tag.sprite,
              w = tag.width >> 5,
              sw = size[0] >> 5,
              lx = tag.x - (w << 4),
              sx = lx & 0x7f,
              msx = 32 - sx,
              h = tag.y1 - tag.y0,
              x = (tag.y + tag.y0) * sw + (lx >> 5),
              last;
          for (var j = 0; j < h; j++) {
            last = 0;
            for (var i = 0; i <= w; i++) {
              board[x + i] |= (last << msx) | (i < w ? (last = sprite[j * w + i]) >>> sx : 0);
            }
            x += sw;
          }
          return true;
        }
      }
    }
    return false;
  }

  cloud.timeInterval = function(_) {
    return arguments.length ? (timeInterval = _ == null ? Infinity : _, cloud) : timeInterval;
  };

  cloud.words = function(_) {
    return arguments.length ? (words = _, cloud) : words;
  };

  // New method to add words (for incremental updates)
  cloud.addWords = function(_) {
    if (!arguments.length) return cloud;
    
    // Add new words to the existing array
    if (Array.isArray(_)) {
      words = words.concat(_);
    } else {
      words.push(_);
    }
    
    return cloud;
  };

  cloud.size = function(_) {
    return arguments.length ? (size = [+_[0], +_[1]], cloud) : size;
  };

  cloud.font = function(_) {
    return arguments.length ? (font = functor(_), cloud) : font;
  };

  cloud.fontStyle = function(_) {
    return arguments.length ? (fontStyle = functor(_), cloud) : fontStyle;
  };

  cloud.fontWeight = function(_) {
    return arguments.length ? (fontWeight = functor(_), cloud) : fontWeight;
  };

  cloud.rotate = function(_) {
    return arguments.length ? (rotate = functor(_), cloud) : rotate;
  };

  cloud.text = function(_) {
    return arguments.length ? (text = functor(_), cloud) : text;
  };

  cloud.spiral = function(_) {
    return arguments.length ? (spiral = SPIRALS[_] || _, cloud) : spiral;
  };

  cloud.fontSize = function(_) {
    return arguments.length ? (fontSize = functor(_), cloud) : fontSize;
  };

  cloud.padding = function(_) {
    return arguments.length ? (padding = functor(_), cloud) : padding;
  };

  cloud.random = function(_) {
    return arguments.length ? (random = _, cloud) : random;
  };

  cloud.on = function() {
    var value = event.on.apply(event, arguments);
    return value === event ? cloud : value;
  };

  // New method to get the current tags
  cloud.tags = function() {
    return existingTags.slice();
  };

  return cloud;
};

function cloudText(d) {
  return d.text;
}

function cloudFont() {
  return "serif";
}

function cloudFontNormal() {
  return "normal";
}

function cloudFontSize(d) {
  return Math.sqrt(d.value);
}

function cloudRotate() {
  return (~~(random() * 6) - 3) * 30;
}

function cloudPadding() {
  return 1;
}

// Fetches a monochrome sprite bitmap for the specified text.
// Load in batches for speed.
function cloudSprite(contextAndRatio, d, data, di) {
  if (d.sprite) return;
  var c = contextAndRatio.context,
      ratio = contextAndRatio.ratio;

  c.clearRect(0, 0, (cw << 5) / ratio, ch / ratio);
  var x = 0,
      y = 0,
      maxh = 0,
      n = data.length;
  --di;
  while (++di < n) {
    d = data[di];
    c.save();
    c.font = d.style + " " + d.weight + " " + ~~((d.size + 1) / ratio) + "px " + d.font;
    const metrics = c.measureText(d.text);
    const anchor = -Math.floor(metrics.width / 2);
    let w = (metrics.width + 1) * ratio;
    let h = d.size << 1;
    if (d.rotate) {
      var sr = Math.sin(d.rotate * RADIANS),
          cr = Math.cos(d.rotate * RADIANS),
          wcr = w * cr,
          wsr = w * sr,
          hcr = h * cr,
          hsr = h * sr;
      w = (Math.max(Math.abs(wcr + hsr), Math.abs(wcr - hsr)) + 0x1f) >> 5 << 5;
      h = ~~Math.max(Math.abs(wsr + hcr), Math.abs(wsr - hcr));
    } else {
      w = (w + 0x1f) >> 5 << 5;
    }
    if (h > maxh) maxh = h;
    if (x + w >= (cw << 5)) {
      x = 0;
      y += maxh;
      maxh = 0;
    }
    if (y + h >= ch) break;
    c.translate((x + (w >> 1)) / ratio, (y + (h >> 1)) / ratio);
    if (d.rotate) c.rotate(d.rotate * RADIANS);
    c.fillText(d.text, anchor, 0);
    if (d.padding) c.lineWidth = 2 * d.padding, c.strokeText(d.text, anchor, 0);
    c.restore();
    d.width = w;
    d.height = h;
    d.xoff = x;
    d.yoff = y;
    d.x1 = w >> 1;
    d.y1 = h >> 1;
    d.x0 = -d.x1;
    d.y0 = -d.y1;
    d.hasText = true;
    x += w;
  }
  var pixels = c.getImageData(0, 0, (cw << 5) / ratio, ch / ratio).data,
      sprite = [];
  while (--di >= 0) {
    d = data[di];
    if (!d.hasText) continue;
    var w = d.width,
        w32 = w >> 5,
        h = d.y1 - d.y0;
    // Zero the buffer
    for (var i = 0; i < h * w32; i++) sprite[i] = 0;
    x = d.xoff;
    if (x == null) return;
    y = d.yoff;
    var seen = 0,
        seenRow = -1;
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        var k = w32 * j + (i >> 5),
            m = pixels[((y + j) * (cw << 5) + (x + i)) << 2] ? 1 << (31 - (i % 32)) : 0;
        sprite[k] |= m;
        seen |= m;
      }
      if (seen) seenRow = j;
      else {
        d.y0++;
        h--;
        j--;
        y++;
      }
    }
    d.y1 = d.y0 + seenRow;
    d.sprite = sprite.slice(0, (d.y1 - d.y0) * w32);
  }
}

// Use mask-based collision detection.
function cloudCollide(tag, board, sw) {
  sw >>= 5;
  var sprite = tag.sprite,
      w = tag.width >> 5,
      lx = tag.x - (w << 4),
      sx = lx & 0x7f,
      msx = 32 - sx,
      h = tag.y1 - tag.y0,
      x = (tag.y + tag.y0) * sw + (lx >> 5),
      last;
  for (var j = 0; j < h; j++) {
    last = 0;
    for (var i = 0; i <= w; i++) {
      if (((last << msx) | (i < w ? (last = sprite[j * w + i]) >>> sx : 0))
          & board[x + i]) return true;
    }
    x += sw;
  }
  return false;
}

function cloudBounds(bounds, d) {
  var b0 = bounds[0],
      b1 = bounds[1];
  if (d.x + d.x0 < b0.x) b0.x = d.x + d.x0;
  if (d.y + d.y0 < b0.y) b0.y = d.y + d.y0;
  if (d.x + d.x1 > b1.x) b1.x = d.x + d.x1;
  if (d.y + d.y1 > b1.y) b1.y = d.y + d.y1;
}

function collideRects(a, b) {
  return a.x + a.x1 > b[0].x && a.x + a.x0 < b[1].x && a.y + a.y1 > b[0].y && a.y + a.y0 < b[1].y;
}

function archimedeanSpiral(size) {
  var e = size[0] / size[1];
  return function(t) {
    return [e * (t *= .1) * Math.cos(t), t * Math.sin(t)];
  };
}

function rectangularSpiral(size) {
  var dy = 4,
      dx = dy * size[0] / size[1],
      x = 0,
      y = 0;
  return function(t) {
    var sign = t < 0 ? -1 : 1;
    // See triangular numbers: T_n = n * (n + 1) / 2.
    switch ((Math.sqrt(1 + 4 * sign * t) - sign) & 3) {
      case 0:  x += dx; break;
      case 1:  y += dy; break;
      case 2:  x -= dx; break;
      default: y -= dy; break;
    }
    return [x, y];
  };
}

// TODO reuse arrays?
function zeroArray(n) {
  var a = [],
      i = -1;
  while (++i < n) a[i] = 0;
  return a;
}

function cloudCanvas() {
  return document.createElement("canvas");
}

function functor(d) {
  return typeof d === "function" ? d : function() { return d; };
}
