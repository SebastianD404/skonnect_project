const fs = require('fs');
const http = require('http');
const path = require('path');

const filePath = path.resolve(process.cwd(), 'tmp_skeap_docx/word/media/image1.png');
const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
const payload = [];
payload.push(`--${boundary}\r\n`);
payload.push('Content-Disposition: form-data; name="file"; filename="image1.png"\r\n');
payload.push('Content-Type: image/png\r\n\r\n');
payload.push(fs.readFileSync(filePath));
payload.push('\r\n');
payload.push(`--${boundary}\r\n`);
payload.push('Content-Disposition: form-data; name="documentType"\r\n\r\n');
payload.push('front_id\r\n');
payload.push(`--${boundary}--\r\n`);

const data = Buffer.concat(payload.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(part)));
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/validate-document',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': data.length,
  },
}, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log(body);
  });
});
req.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
req.write(data);
req.end();
