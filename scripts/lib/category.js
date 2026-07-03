// ~/.claude/skills/iconpark/lib/category.js
// 双层分类决策树:主分类(36 官方语义,必选) + 辅分类(7 色彩/样式,可空)
// 数据结构参考 data/category-decision.json 的 v2 schema

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', '..', 'assets', 'data', 'category-decision.json');

let _decision = null;

async function loadDecision() {
  if (_decision) return _decision;
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  _decision = JSON.parse(raw);
  return _decision;
}

/**
 * 在指定 rules 中找最佳命中分类
 * @param {string} text - 已 lower-case 的输入文本
 * @param {Array<{category: string, keywords: string[], rationale: string}>} rules
 * @param {string} defaultCategory
 * @param {Array<string>} allCategories
 * @returns {{primary: string, alternatives: string[], rationale: string}}
 */
function matchRules(text, rules, defaultCategory, allCategories) {
  const matches = [];
  for (const rule of rules) {
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

  const sorted = Array.from(byCategory.values()).sort((a, b) => b.count - a.count);

  if (sorted.length > 0) {
    return {
      primary: sorted[0].category,
      alternatives: allCategories.filter((c) => c !== sorted[0].category),
      rationale: `关键词命中（${sorted[0].keyword}）→ ${sorted[0].rationale}`,
    };
  }

  return {
    primary: defaultCategory,
    alternatives: allCategories.filter((c) => c !== defaultCategory),
    rationale: '未命中关键词，使用默认分类',
  };
}

/**
 * 双层分类推荐
 * @param {string} identifierOrName
 * @param {object} [opts]
 * @param {string} [opts.hintPrimary] - 设计师给定的主分类提示
 * @param {string} [opts.hintSub] - 设计师给定的辅分类提示
 * @param {boolean} [opts.skipSub] - 跳过辅分类（适用于设计师只问主分类时）
 * @returns {Promise<{primary: object, sub: object|null, group: string}>}
 *
 * group 字段格式: "主分类 · 辅分类"（如 "界面组件 · 常规线性"）
 */
export async function recommendCategory(identifierOrName, opts = {}) {
  const { hintPrimary, hintSub, skipSub } = opts;
  const decision = await loadDecision();
  const text = (identifierOrName || '').toLowerCase();

  // 主分类
  let primary;
  if (hintPrimary && decision._primary_categories.includes(hintPrimary)) {
    primary = {
      primary: hintPrimary,
      alternatives: decision._primary_categories.filter((c) => c !== hintPrimary),
      rationale: '设计师指定主分类',
    };
  } else {
    primary = matchRules(
      text,
      decision.primary_rules,
      decision.primary_default,
      decision._primary_categories,
    );
  }

  // 辅分类（可空）
  let sub = null;
  if (!skipSub) {
    if (hintSub && decision._sub_categories.includes(hintSub)) {
      sub = {
        primary: hintSub,
        alternatives: decision._sub_categories.filter((c) => c !== hintSub),
        rationale: '设计师指定辅分类',
      };
    } else {
      sub = matchRules(
        text,
        decision.sub_rules,
        decision.sub_default,
        decision._sub_categories,
      );
    }
  }

  const group = sub ? `${primary.primary} · ${sub.primary}` : primary.primary;

  return { primary, sub, group };
}

/**
 * 列出所有主分类(36 选 1)
 */
export async function listPrimaryCategories() {
  const decision = await loadDecision();
  return decision._primary_categories;
}

/**
 * 列出所有辅分类(7 选 1)
 */
export async function listSubCategories() {
  const decision = await loadDecision();
  return decision._sub_categories;
}

// 保留旧 listCategories 兼容旧调用（返回主分类列表）
export async function listCategories() {
  return listPrimaryCategories();
}
