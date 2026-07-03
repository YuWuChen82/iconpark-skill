// ~/.claude/skills/iconpark/lib/category.js
// 分类决策树：根据 identifier / 中文名推荐分类

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'category-decision.json');

let _decision = null;

async function loadDecision() {
  if (_decision) return _decision;
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  _decision = JSON.parse(raw);
  return _decision;
}

/**
 * 根据 identifier / 中文名推荐分类
 * @param {string} identifierOrName
 * @param {string} [hintCategory] - 设计师给定的分类提示
 * @returns {Promise<{primary: string, alternatives: string[], rationale: string}>}
 */
export async function recommendCategory(identifierOrName, hintCategory) {
  const decision = await loadDecision();
  const text = (identifierOrName || '').toLowerCase();

  if (hintCategory && decision.categories.includes(hintCategory)) {
    return {
      primary: hintCategory,
      alternatives: decision.categories.filter((c) => c !== hintCategory),
      rationale: '设计师指定',
    };
  }

  // 命中关键词
  const matches = [];
  for (const rule of decision.rules) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        matches.push({ category: rule.category, keyword: kw, rationale: rule.rationale });
        break;
      }
    }
  }

  // 去重按 category 聚合
  const byCategory = new Map();
  for (const m of matches) {
    if (!byCategory.has(m.category)) {
      byCategory.set(m.category, { ...m, count: 1 });
    } else {
      byCategory.get(m.category).count += 1;
    }
  }

  // 排序：命中次数多的优先
  const sorted = Array.from(byCategory.values()).sort((a, b) => b.count - a.count);

  if (sorted.length > 0) {
    return {
      primary: sorted[0].category,
      alternatives: decision.categories.filter((c) => c !== sorted[0].category),
      rationale: `关键词命中（${sorted[0].keyword}）→ ${sorted[0].rationale}`,
    };
  }

  return {
    primary: decision.default_category,
    alternatives: decision.categories.filter((c) => c !== decision.default_category),
    rationale: '未命中关键词，使用默认分类',
  };
}

export async function listCategories() {
  const decision = await loadDecision();
  return decision.categories;
}