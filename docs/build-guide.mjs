import { readFileSync, writeFileSync } from 'node:fs';

const imgs = {
  IMG_01: '/tmp/w_01-login-window.jpg',
  IMG_02: '/tmp/w_02-login-form.jpg',
  IMG_03: '/tmp/w_03-builds-list.jpg',
  IMG_04: '/tmp/w_04-submission-detail.jpg',
  IMG_05: '/tmp/w_05-submission-body.jpg',
};

let html = readFileSync('guide-template.html', 'utf8');
for (const [key, path] of Object.entries(imgs)) {
  const b64 = readFileSync(path).toString('base64');
  html = html.replace(`{{${key}}}`, `data:image/jpeg;base64,${b64}`);
}
if (html.includes('{{')) throw new Error('치환되지 않은 자리표시자가 남았습니다');
writeFileSync('gsd-submit-guide.html', html);
console.log('완료:', (html.length / 1024).toFixed(0) + 'KB');
