// filter-app.js — Barbro AR Filter (ES Module)
import { FaceLandmarker, FilesetResolver }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const video  = document.getElementById("webcam");
const canvas = document.getElementById("output_canvas");
const ctx    = canvas.getContext("2d");

// Preload overlay images (transparent PNGs in same folder)
const beardImg   = new Image(); beardImg.src   = "beard.png";
const hairImg    = new Image(); hairImg.src    = "hair.png";
const glassesImg = new Image(); glassesImg.src = "glasses.png";

let faceLandmarker = null;
let running = false;

// ── Wait for user to click Activate Camera ──────────────────
function pollForStart() {
  if (window.cameraRequested) {
    init();
  } else {
    setTimeout(pollForStart, 150);
  }
}
pollForStart();

// ── Main init ────────────────────────────────────────────────
async function init() {
  try {
    // 1. Load MediaPipe model
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1
    });

    // 2. Open webcam
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false
    });

    video.srcObject = stream;

    // 3. Wait for video to be ready
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = reject;
      setTimeout(reject, 10000); // 10s timeout
    });

    await video.play();

    // 4. Notify UI
    if (window.onCameraReady) window.onCameraReady();
    running = true;
    requestAnimationFrame(predict);

  } catch (err) {
    console.error("Barbro Filter Error:", err);
    let msg = "Could not start camera. ";
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      msg += "Camera permission was denied. Please allow camera access in your browser and try again.";
    } else if (err.name === "NotFoundError") {
      msg += "No camera found on this device.";
    } else if (err.name === "NotReadableError") {
      msg += "Camera is already in use by another application.";
    } else if (!window.isSecureContext) {
      msg += "Camera requires a secure connection. Please open this page via the local server (http://localhost:3000).";
    } else {
      msg += err.message || "Unknown error.";
    }
    if (window.onCameraError) window.onCameraError(msg);
  }
}

// ── Prediction loop ──────────────────────────────────────────
function predict() {
  if (!running || !faceLandmarker) return;

  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;

  // Draw video frame onto canvas first — this fills the background
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const results = faceLandmarker.detectForVideo(video, performance.now());

  if (results.faceLandmarks && results.faceLandmarks.length > 0) {
    drawOverlay(results.faceLandmarks[0]);
  }

  requestAnimationFrame(predict);
}

// ── Remove black background from image ───────────────────────
// Draws image to offscreen canvas, sets dark pixels to transparent
const offCanvas = document.createElement("canvas");
const offCtx    = offCanvas.getContext("2d");

function removeBlackBg(img, w, h) {
  offCanvas.width  = w;
  offCanvas.height = h;
  offCtx.clearRect(0, 0, w, h);
  offCtx.drawImage(img, 0, 0, w, h);
  const imageData = offCtx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const brightness = (r + g + b) / 3;
    if (brightness < 30) {
      data[i+3] = 0;                                         // black bg → transparent
    } else if (brightness < 70) {
      data[i+3] = Math.round((brightness - 30) / 40 * 255); // soft edge
      data[i]   = Math.round(r * 0.35);
      data[i+1] = Math.round(g * 0.30);
      data[i+2] = Math.round(b * 0.28);
    } else {
      // Keep texture, darken significantly — multiply toward dark brown/black
      data[i]   = Math.round(r * 0.38);
      data[i+1] = Math.round(g * 0.32);
      data[i+2] = Math.round(b * 0.28);
      data[i+3] = 255;
    }
  }
  offCtx.putImageData(imageData, 0, 0);
  return offCanvas;
}

// ── Draw AR overlay ──────────────────────────────────────────
function drawOverlay(lm) {
  const filter = window.currentFilter || "none";
  if (filter === "none") return;

  const W = canvas.width;
  const H = canvas.height;

  // Face width: distance between jaw points 234 and 454
  const faceWidth = Math.abs(lm[454].x - lm[234].x) * W;

  if (filter === "beard") {
    const chin  = lm[152];
    const mouth = lm[13];
    const imgW  = faceWidth * 1.1;
    const imgH  = faceWidth * 1.0;
    const x     = chin.x * W - imgW / 2;
    // Move up: anchor top of beard at mouth level
    const y     = mouth.y * H - imgH * 0.35;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    // Draw via offscreen canvas with black pixels removed
    const off   = removeBlackBg(beardImg, imgW, imgH);
    ctx.drawImage(off, x, y, imgW, imgH);
    ctx.restore();

  } else if (filter === "hair") {
    const forehead = lm[10];
    const imgW = faceWidth * 1.85;  // matches head width as confirmed
    const imgH = faceWidth * 1.6;
    const x    = forehead.x * W - imgW / 2 + faceWidth * 0.05;
    const y    = forehead.y * H - imgH * 0.42;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(hairImg, x, y, imgW, imgH);
    ctx.restore();

  } else if (filter === "glasses") {
    // Anchor between eyes: midpoint of left eye (33) and right eye (263)
    const lEye = lm[33];
    const rEye = lm[263];
    const midX = ((lEye.x + rEye.x) / 2) * W;
    const midY = ((lEye.y + rEye.y) / 2) * H;
    const eyeSpan = Math.abs(rEye.x - lEye.x) * W;
    ctx.drawImage(
      glassesImg,
      midX - eyeSpan * 0.9,
      midY - eyeSpan * 0.5,
      eyeSpan * 1.8,
      eyeSpan * 0.9
    );
  }
}
