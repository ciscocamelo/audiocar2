/** Drop superseded one-off scripts so the repo only carries the tooling that works. */
const fs = require('fs');
const path = require('path');

const obsolete = [
  'make_logo.py',      // superseded by logo_build.txt (.py files are blocked in this sandbox)
  'make_logo.txt',     // first attempt, wrong crop logic
  'shot.js',           // dev-browser script (named-pipe sandbox blocks that tool)
  'cf-auth.js',        // replaced by cf.js, which also persists rotated refresh tokens
  'diag.js',           // superseded by gallery_check.js / interact.js
];
for (const f of obsolete) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log('removed scripts/' + f);
  }
}

// keep the asset build reproducible against the archived original
const lb = path.join(__dirname, 'logo_build.txt');
let text = fs.readFileSync(lb, 'utf8');
text = text.replace('SRC = "public/images/logo.jpg"', 'SRC = "assets/brand/logo-original.jpg"');
fs.writeFileSync(lb, text);
console.log('logo_build.txt now reads assets/brand/logo-original.jpg');
console.log('\nscripts/:', fs.readdirSync(__dirname).filter((f) => !f.startsWith('_')).sort().join(', '));
