#!/usr/bin/env node
/**
 * scripts/release.cjs
 *
 * 一键发布流程（changeset + npm version + bnpm publish）：
 *
 * 1. npx changeset       ← 选版本级别（patch/minor/major）,写 changelog
 * 2. npx changeset version   ← bump + 生成 .changeset/*.md
 * 3. npm version patch/minor/major ← bump package.json + sync SKILL.md + git tag
 * 4. git push --follow-tags   ← 推送远端
 * 5. npm publish              ← 发到 bnpm
 *
 * 用法：
 *   node scripts/release.cjs          # interactive: 问你要发哪个级别
 *   node scripts/release.cjs patch    # 直接发 patch
 *   node scripts/release.cjs minor    # 直接发 minor
 *   node scripts/release.cjs major    # 直接发 major
 */

const cp = require('child_process');
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });

const type = process.argv[2];
const types = ['patch', 'minor', 'major'];

if (type && !types.includes(type)) {
  console.error(`❌ 参数必须是 ${types.join(' / ')}，当前: ${type}`);
  process.exit(1);
}

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function run(cmd, opts = {}) {
  console.log(`\n▶  ${cmd}`);
  return cp.execSync(cmd, { stdio: type ? 'pipe' : 'inherit', ...opts });
}

(async () => {
  let level = type;

  if (!level) {
    console.log('\n=== 选择版本级别 ===');
    console.log('  1) patch  — 修 bug (0.7.2 → 0.7.3)');
    console.log('  2) minor  — 加功能 (0.7.2 → 0.8.0)');
    console.log('  3) major  — 破坏性变更 (0.7.2 → 1.0.0)');
    const answer = await ask('\n请输入 1/2/3: ');
    level = types[parseInt(answer) - 1] || 'patch';
  }

  // 1. changeset
  console.log('\n=== Step 1: changeset ===');
  run(`npx changeset`, { stdio: 'inherit' });

  // 2. changeset version (bump + .changeset/*.md 生成 + 清理已用 changeset)
  console.log('\n=== Step 2: changeset version ===');
  run(`npx changeset version`, { stdio: 'inherit' });

  // 3. npm version (sync SKILL.md frontmatter via scripts/sync-version.cjs)
  console.log(`\n=== Step 3: npm version ${level} ===`);
  run(`npm version ${level}`, { stdio: 'inherit' });

  // 4. push
  console.log('\n=== Step 4: git push --follow-tags ===');
  run('git push --follow-tags', { stdio: 'inherit' });

  // 5. bnpm publish
  console.log('\n=== Step 5: npm publish (bnpm) ===');
  run('npm publish', { stdio: 'inherit' });

  console.log('\n✅  发布完成。确认: npm view @yuwuchen/iconpark-skill --registry https://bnpm.byted.org');
  rl.close();
})().catch(e => {
  console.error('❌ 发布中断:', e.message);
  process.exit(1);
});
