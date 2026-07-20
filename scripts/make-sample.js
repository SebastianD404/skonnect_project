const fs = require('fs');
const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBAp8QGZkAAAAASUVORK5CYII=';
const buf = Buffer.from(base64, 'base64');
fs.writeFileSync('scripts/sample.png', buf);
console.log('Wrote scripts/sample.png');
