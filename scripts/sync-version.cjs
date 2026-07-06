#!/usr/bin/env node
/**
 * npm version 生命周期钩子。
 * 把 VERSION 文件 + SKILL.md frontmatter 同步到 package.json 的新版本号。
 * 由 package.json scripts.version 调用。
 */
const v = require('../package.json').version;
const fs = require('fs');
const cp = require('child_process');
fs.writeFileSync('VERSION', v + '\n');
let md = fs.readFileSync('SKILL.md', 'utf8');
md = md.replace(/^version: [^\n]+/m, 'version: ' + v);
fs.writeFileSync('SKILL.md', md);
cp.execSync('git add VERSION SKILL.md', { cwd: process.cwd() });
console.log(`✓ synced VERSION + SKILL.md → v${v}`);
