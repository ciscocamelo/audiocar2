const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
console.log('ld+json blocks:', blocks.length);
for (const [i, b] of blocks.entries()) {
  try {
    const j = JSON.parse(b[1]);
    console.log(`block ${i}: OK @type=${j['@type']} name=${j.name}`);
    console.log('  telephone:', j.telephone);
    console.log('  address:', JSON.stringify(j.address));
    console.log('  hours:', JSON.stringify(j.openingHoursSpecification || j.openingHours));
    console.log('  geo:', JSON.stringify(j.geo));
    console.log('  url:', j.url);
  } catch (e) {
    console.log(`block ${i}: INVALID JSON —`, e.message);
  }
}
// accessibility quick facts
const hasSkip = /class="skip|skip-link|Pular para/.test(html);
const h1 = [...html.matchAll(/<h1[\s>]/g)].length;
const imgsNoAlt = [...html.matchAll(/<img(?![^>]*\balt=)[^>]*>/g)].length;
const buttonsNoLabel = [...html.matchAll(/<button(?![^>]*aria-label)[^>]*>\s*<svg/g)].length;
console.log({ hasSkip, h1Count: h1, imgsWithoutAlt: imgsNoAlt, iconButtonsWithoutLabel: buttonsNoLabel });
