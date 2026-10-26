/** Move QA screenshots out of the deploy folder and delete temp artifacts. */
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const SHOTS = path.join(__dirname, '_shots');
fs.mkdirSync(SHOTS, { recursive: true });

// move screenshots out of /public
const pubShots = path.join(PUB, '_shots');
if (fs.existsSync(pubShots)) {
  for (const f of fs.readdirSync(pubShots)) {
    fs.renameSync(path.join(pubShots, f), path.join(SHOTS, f));
  }
  fs.rmdirSync(pubShots);
  console.log('moved screenshots ->', SHOTS);
}

// delete temp files accidentally created in /public
const junk = ['_preview_dark.png', '_preview_light.png', '_pytest.png', '_contact_sheet.jpg', '_test.txt'];
for (const f of junk) {
  const p = path.join(PUB, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log('removed', f);
  }
}
for (const f of fs.readdirSync(PUB)) {
  if (f.startsWith('_')) console.log('WARNING leftover:', f);
}
console.log('public files:', fs.readdirSync(PUB).join(', '));
