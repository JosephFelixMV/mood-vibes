// PostToolUse hook: prints a lint reminder when a TypeScript file is edited.
// Claude Code sends tool input as JSON on stdin.
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString());
    const filePath = (input.tool_input || {}).file_path || '';
    if (/\.(ts|tsx)$/.test(filePath) && !filePath.includes('supabase/types')) {
      process.stdout.write(`[mood-vibes] TS file edited: ${filePath.split('/src/').pop() || filePath}\n`);
      process.stdout.write(`[mood-vibes] Run \`npm run lint\` before pushing to Lovable-Dev\n`);
    }
  } catch (_) {
    // silently ignore — never block tool execution
  }
  process.exit(0);
});
