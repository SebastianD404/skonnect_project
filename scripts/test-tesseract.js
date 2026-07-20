const path = require('path');
try {
  const t = require('tesseract.js');
  console.log('tesseract keys:', Object.keys(t));
  console.log('createWorker type:', typeof t.createWorker);
  try {
    const main = require.resolve('tesseract.js');
    console.log('tesseract main:', main);
    console.log('tesseract dir:', path.dirname(main));
  } catch (e) {
    console.error('require.resolve(tesseract.js) failed:', e && e.message);
  }
  try {
    const workerPath = require.resolve('tesseract.js/src/worker-script/node/index.js');
    console.log('resolved workerPath:', workerPath);
  } catch (e) {
    console.error('resolve workerPath failed:', e && e.message);
  }
  try {
    const corePath = require.resolve('tesseract.js-core/tesseract-core.wasm.js');
    console.log('resolved corePath:', corePath);
  } catch (e) {
    console.error('resolve corePath failed:', e && e.message);
  }
} catch (err) {
  console.error('require(tesseract.js) failed:', err && err.message);
  process.exit(1);
}
