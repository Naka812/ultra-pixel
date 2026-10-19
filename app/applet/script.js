const fs = require('fs');
const files = ['components/Editor.tsx', 'components/GlobalTooltip.tsx'];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/bg-\[#262626\]/g, 'bg-[#1a1a1a]');
  fs.writeFileSync(f, content);
});
