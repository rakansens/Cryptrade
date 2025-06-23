// Simple Node.js script to test greeting patterns
const testStrings = [
  'こんにちは！',
  'こんにちは',
  'おはようございます！今日も頑張りましょう',
  'hello',
  'hi',
];

const greetingPatterns = [
  /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！]?\.?$/i,
  /^(よろしく)\.?$/i,
  /^hi\s+there$/i,
  /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！、。]?[\s、。]?\S/i,
];

console.log('Testing greeting patterns:\n');

testStrings.forEach(str => {
  const strLower = str.toLowerCase();
  console.log(`Testing: "${str}"`);
  
  greetingPatterns.forEach((pattern, idx) => {
    const matchOriginal = pattern.test(str);
    const matchLower = pattern.test(strLower);
    if (matchOriginal || matchLower) {
      console.log(`  ✓ Pattern ${idx}: original=${matchOriginal}, lower=${matchLower}`);
    }
  });
  
  const matchesAny = greetingPatterns.some(pattern => pattern.test(str) || pattern.test(strLower));
  console.log(`  => Matches any pattern: ${matchesAny}\n`);
});