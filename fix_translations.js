const fs = require('fs');
const ts = fs.readFileSync('lib/translations.ts', 'utf8');

let outLines = [];
let keysEn = new Set();
let keysPt = new Set();
let currentLang = null;

const lines = ts.split('\n');
for(let i=0; i<lines.length; i++) {
  let line = lines[i];
  if (line.match(/^\s*en:\s*\{/)) {
    currentLang = 'en';
  } else if (line.match(/^\s*pt:\s*\{/)) {
    currentLang = 'pt';
  }
  
  const kMatch = line.match(/^\s*([a-zA-Z0-9_]+)\s*:/);
  if (kMatch && currentLang) {
    let key = kMatch[1];
    if (key === 'en' || key === 'pt') {
      outLines.push(line);
      continue;
    }
    
    let keys = currentLang === 'en' ? keysEn : keysPt;
    if (keys.has(key)) {
      console.log('Removing duplicate:', key, 'in', currentLang);
      continue;
    } else {
      keys.add(key);
    }
  }
  outLines.push(line);
}

fs.writeFileSync('lib/translations.ts', outLines.join('\n'));
