
let video;
let faceapi;

const W = 960;
const H = 720;

const CELL = 96;
const GAP = 7;
const COLS = 10;
const ROWS = 7;
const TOTAL = COLS * ROWS;

const START_Y = 24;
const BG = [7, 12, 19];

// Aging settings
const AGING_START = 2500;
const AGING_DURATION = 18000;
const MAX_PIXEL_SIZE = 7;
const MAX_NOISE = 24;

// Disappearance settings
const HOLD_TIME = 3000;
const FADE_DURATION = 7000;

let cells = [];
let currentCell = -1;

let faceDetected = false;
let modelLoaded = false;
let lastFaceTime = 0;

const detection_options = {
  withLandmarks: true,
  withDescriptors: false
};

function setup() {
  createCanvas(W, H);
  pixelDensity(1);
  textFont("monospace");

  for (let i = 0; i < TOTAL; i++) {
    cells.push({
      image: null,
      capturedAt: 0,
      seed: random(10000)
    });
  }

  video = createCapture(VIDEO, videoReady);
  video.size(640, 480);
  video.hide();
}

function videoReady() {
  console.log("Camera ready");

  faceapi = ml5.faceApi(
    video,
    detection_options,
    modelReady
  );
}

function modelReady() {
  modelLoaded = true;
  console.log("FACE MODEL READY!");

  faceapi.detect(gotResults);
}

function gotResults(err, result) {
  if (err) {
    console.error(err);
    return;
  }

  const faces = result || [];
  faceDetected = faces.length > 0;

  if (faceDetected) {
    lastFaceTime = millis();
    captureFace(faces[0]);
  }

  faceapi.detect(gotResults);
}

function captureFace(face) {
  if (!video || video.elt.readyState < 2) {
    return;
  }

  const box = face.alignedRect._box;
  const frame = video.get();

  const sx = constrain(
    floor(box._x),
    0,
    frame.width - 1
  );

  const sy = constrain(
    floor(box._y),
    0,
    frame.height - 1
  );

  const sw = min(
    floor(box._width),
    frame.width - sx
  );

  const sh = min(
    floor(box._height),
    frame.height - sy
  );

  if (sw <= 0 || sh <= 0) return;

  // Keep original colors
  const faceImage = frame.get(sx, sy, sw, sh);

  // Prepare a fixed-size image for distortion
  faceImage.resize(89, 89);

  currentCell = (currentCell + 1) % TOTAL;

  cells[currentCell] = {
    image: faceImage,
    capturedAt: millis(),
    seed: random(10000)
  };
}

function draw() {
  background(...BG);

  const now = millis();
  const timeSinceFace = now - lastFaceTime;

  let fadeProgress = 0;

  if (
    lastFaceTime > 0 &&
    timeSinceFace > HOLD_TIME
  ) {
    fadeProgress = constrain(
      (timeSinceFace - HOLD_TIME) /
        FADE_DURATION,
      0,
      1
    );
  }

  const globalAlpha = 255 * (1 - fadeProgress);

  for (let i = 0; i < TOTAL; i++) {
    const cell = cells[i];

    if (!cell.image) continue;

    if (globalAlpha <= 0) {
      cell.image = null;
      continue;
    }

    const col = i % COLS;
    const row = floor(i / COLS);

    // Mirrored grid position
    const x =
      W - (col + 1) * CELL + GAP / 2;

    const y =
      START_Y + row * CELL + GAP / 2;

    const size = CELL - GAP;

    const age = now - cell.capturedAt;

    const aging = constrain(
      (age - AGING_START) / AGING_DURATION,
      0,
      1
    );

    drawAgedFace(
      cell,
      x,
      y,
      size,
      aging,
      globalAlpha
    );
  }

  drawMinimalInterface();
}

// Render an increasingly degraded face
function drawAgedFace(
  cell,
  x,
  y,
  size,
  aging,
  alpha
) {
  push();

  // Fade the complete face and its effects
  drawingContext.globalAlpha = alpha / 255;

  const img = cell.image;

  // Pixel size increases as the image ages
  const pixelSize = max(
    1,
    floor(1 + aging * MAX_PIXEL_SIZE)
  );

  if (pixelSize <= 1) {
    // Fresh image: completely clear
    image(img, x, y, size, size);
  } else {
    // Older image: pixelated
    const smallW = max(
      8,
      floor(size / pixelSize)
    );

    const smallH = max(
      8,
      floor(size / pixelSize)
    );

    const pixelated = img.get();
    pixelated.resize(smallW, smallH);

    noSmooth();
    image(pixelated, x, y, size, size);
    smooth();
  }

  // Subtle digital horizontal displacement
  if (aging > 0.2) {
    const strips = floor(aging * 5);

    for (let j = 0; j < strips; j++) {
      const stripY =
        floor(
          noise(cell.seed + j * 12.7) *
          (size - 5)
        );

      const stripH = 2 + floor(aging * 3);

      const offset =
        sin(cell.seed + j * 8.3) *
        aging * 7;

      image(
        img,
        x + offset,
        y + stripY,
        size,
        stripH,
        0,
        stripY,
        img.width,
        stripH
      );
    }
  }

  // Static digital noise
  if (aging > 0.05) {
    randomSeed(floor(cell.seed));

    const noiseCount =
      floor(aging * MAX_NOISE);

    noStroke();

    for (let n = 0; n < noiseCount; n++) {
      const nx = x + random(size);
      const ny = y + random(size);

      const brightness =
        random(100, 230);

      fill(
        brightness,
        brightness,
        brightness,
        aging * 90
      );

      rect(
        nx,
        ny,
        random(1, 3),
        random(1, 3)
      );
    }
  }

  // Very subtle blue tint
  noStroke();
  fill(8, 35, 49, 12);
  rect(x, y, size, size);

  // Fine archive border
  noFill();
  stroke(76, 137, 151, 65);
  strokeWeight(0.6);
  rect(x, y, size, size);

  pop();
}

function drawMinimalInterface() {
  noStroke();

  // Header
  fill(...BG);
  rect(0, 0, width, 23);

  fill(91, 128, 140, 130);
  textSize(9);
  textAlign(LEFT, CENTER);

  text("ARCHIVE / 001", 12, 12);

  // Small status indicator
  if (modelLoaded) {
    if (faceDetected) {
      fill(104, 190, 203, 140);
    } else {
      fill(79, 91, 101, 100);
    }

    circle(width - 16, 12, 4);
  }

  // Footer
  noStroke();
  fill(...BG);
  rect(0, height - 24, width, 24);

  stroke(54, 90, 104, 65);
  strokeWeight(0.5);

  line(
    12,
    height - 24,
    width - 12,
    height - 24
  );
}

// Click to reset
function mousePressed() {
  for (let i = 0; i < TOTAL; i++) {
    cells[i].image = null;
  }

  currentCell = -1;
  lastFaceTime = 0;
}

// Press S to save
function keyPressed() {
  if (key === "s" || key === "S") {
    saveCanvas("Face-Archive-Aging", "png");
  }
}
