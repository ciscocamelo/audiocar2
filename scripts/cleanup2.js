/** Remove QA leftovers from the deploy folder and keep the original logo as a source asset. */
const fs = require('fs');
const path = require('path');

const IMG = path.join(__dirname, '..', 'public', 'images');
const ASSETS = path.join(__dirname, '..', 'assets', 'brand');

const junk = [
  '_contact_sheet.jpg',
  '_preview_dark.png',
  '_preview_light.png',
  '_pytest.png',
  '_test.txt',
  'icon-64.png',
];
for (const f of junk) {
  const p = path.join(IMG, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log('removed public/images/' + f);
  }
}

// original artwork stays in the repo as a brand source, outside the deploy folder
const srcLogo = path.join(IMG, 'logo.jpg');
fs.mkdirSync(ASSETS, { recursive: true });
if (fs.existsSync(srcLogo)) {
  fs.renameSync(srcLogo, path.join(ASSETS, 'logo-original.jpg'));
  console.log('moved original logo -> assets/brand/logo-original.jpg');
}

console.log('\npublic/images now contains:');
console.log(fs.readdirSync(IMG).sort().join(', '));
