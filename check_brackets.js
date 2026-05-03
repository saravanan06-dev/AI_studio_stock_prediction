
import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

let openBrackets = [];
let openParens = [];
let openCurlys = [];
let jsxStack = [];

for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
  const line = lines[lineIdx];
  const lineNum = lineIdx + 1;
  const chars = line.split('');
  
  for (let charIdx = 0; charIdx < chars.length; charIdx++) {
    const char = chars[charIdx];
    
    if (char === '(') openParens.push({line: lineNum});
    else if (char === ')') {
      if (openParens.length === 0) console.log(`Extra ) at line ${lineNum}`);
      else openParens.pop();
    }
    else if (char === '{') openCurlys.push({line: lineNum});
    else if (char === '}') {
      if (openCurlys.length === 0) console.log(`Extra } at line ${lineNum}`);
      else openCurlys.pop();
    }
    else if (char === '[') openBrackets.push({line: lineNum});
    else if (char === ']') {
      if (openBrackets.length === 0) console.log(`Extra ] at line ${lineNum}`);
      else openBrackets.pop();
    }
    else if (char === '<') {
      const nextChar = chars[charIdx + 1];
      if (nextChar === '/') {
        let tag = "";
        let k = charIdx + 2;
        while(k < chars.length && chars[k] !== '>') {
          tag += chars[k];
          k++;
        }
        tag = tag.trim();
        if (tag === "") tag = "Fragment";
        
        if (jsxStack.length === 0) console.log(`Extra closing tag </${tag}> at line ${lineNum}`);
        else {
          const lastTag = jsxStack.pop();
          if (lastTag.name !== tag && tag !== "Fragment" && lastTag.name !== "Fragment") {
            // console.log(`Tag mismatch: </${tag}> at line ${lineNum} closed <${lastTag.name}> from line ${lastTag.line}`);
          }
        }
        charIdx = k;
      } else if (nextChar === '>') {
          jsxStack.push({ name: 'Fragment', line: lineNum });
          charIdx++;
      } else if (/[a-zA-Z]/.test(nextChar)) {
          let tag = "";
          let k = charIdx + 1;
          while(k < chars.length && !/[\s>]/.test(chars[k])) {
            tag += chars[k];
            k++;
          }
          
          // Check if self-closing
          let isSelfClosing = false;
          let m = k;
          while(m < chars.length && chars[m] !== '>') {
            if (chars[m] === '/' && chars[m+1] === '>') {
              isSelfClosing = true;
              break;
            }
            m++;
          }
          if (!isSelfClosing && tag !== "img" && tag !== "br" && tag !== "hr" && tag !== "input") {
             jsxStack.push({ name: tag, line: lineNum });
          }
          charIdx = m;
      }
    }
  }
}

console.log('--- Summary ---');
console.log(`Open Parens: ${openParens.length}`, openParens.slice(-5));
console.log(`Open Curlys: ${openCurlys.length}`, openCurlys.slice(-5));
console.log(`Open Brackets: ${openBrackets.length}`, openBrackets.slice(-5));
console.log(`JSX Stack: ${jsxStack.length}`, jsxStack.slice(-5));
