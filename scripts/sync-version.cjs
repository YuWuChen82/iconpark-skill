#!/usr/bin/env node
/**
 * npm version 生命周期钩子。
 * 把 SKILL.md frontmatter 版本字段同步到 package.json 的新版本号。
 * 由 package.json scripts.version 调用。
 */
const v = require('../package.json').version;
const fs = require('fs');
const cp = require('child_process');

const md = fs.readFileSync('SKILL.md', 'utf8').replace(/^version: [^\n]+/m, 'version: ' + v);
fs.writeFileSync('SKILL.md', md);

cp.execSync('git add SKILL.md', { cwd: process.cwd() });
console.log(`✓ synced SKILL.md frontmatter → v${v}`);
