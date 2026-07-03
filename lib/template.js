// ~/.claude/skills/iconpark/lib/template.js
// 生成 IconPark 组件配置粘贴文本

import { cleanFilename, identifierFromCleaned, hasChinese, tokenizeChinese, PREFIX_CONST } from './naming.js';

/**
 * 生成组件配置粘贴文本
 * @param {object} params
 * @param {string} params.identifier - 如 jc-icon-info
 * @param {string} params.nameZh - 中文名
 * @param {string} params.nameEn - 英文名
 * @param {string} params.category - 分组
 * @param {string[]} [params.tags] - 标签
 * @param {boolean} [params.followFill=true] - 是否开启颜色跟随
 * @param {boolean} [params.colorAdaptive=true] - 是否勾选描边颜色自适应
 * @returns {string}
 */
export function generateTemplate({
  identifier,
  nameZh = '',
  nameEn = '',
  category = '常规线性',
  tags = [],
  followFill = true,
  colorAdaptive = true,
}) {
  const lines = [
    `组件标识: ${identifier}`,
    `中文名称: ${nameZh}`,
    `英文名称: ${nameEn || identifier.replace(/^jc-icon-/, '')}`,
    `分组: ${category}`,
    `标签: ${tags.length > 0 ? tags.join('、') : '（空）'}`,
    `颜色跟随: ${followFill ? '开启' : '关闭'}`,
    `描边颜色自适应: ${colorAdaptive ? '勾选' : '不勾选'}`,
  ];
  return lines.join('\n');
}

/**
 * 从 SVG 文件名推断 identifier
 * - 中文文件名：走 ZH_MAPPING（拼接命中的 token）
 * - 英文文件名：清洗链（扩展名 → 项目前缀 → 版本 → 年份）→ kebab-case → 拼前缀
 *
 * 示例：
 *   cursor.svg → jc-icon-cursor
 *   cursor-2026.svg → jc-icon-cursor
 *   cursor-v2.svg → jc-icon-cursor
 *   agent-click.svg → jc-icon-click
 *   光标.svg → jc-icon-cursor
 *   双星.svg → jc-icon-star
 */
export function identifierFromFilename(filename) {
  const base = cleanFilename(filename);
  if (!base) return null;

  // 中文路径：走 ZH_MAPPING
  if (hasChinese(base)) {
    const { tokens } = tokenizeChinese(base);
    if (tokens.length > 0) {
      return `${PREFIX_CONST}${tokens.join('-')}`;
    }
    return null;
  }

  // 英文路径：kebab-case + 前缀
  return identifierFromCleaned(base);
}