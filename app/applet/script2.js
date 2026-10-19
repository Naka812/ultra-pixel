const fs = require('fs');
let content = fs.readFileSync('components/Editor.tsx', 'utf8');
content = content.replace('<div className="flex border-b border-white/10 bg-[#1a1a1a]">', '<div className="flex border-b border-white/10 bg-[#1a1a1a] h-[41px]">');
fs.writeFileSync('components/Editor.tsx', content);
