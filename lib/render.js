// ~/.claude/skills/iconpark/lib/render.js
// 卡片输出渲染（终端友好）

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function color(c, s) {
  return `${COLORS[c]}${s}${COLORS.reset}`;
}

function truncate(s, w) {
  return String(s).length > w ? String(s).slice(0, w - 1) + '…' : String(s);
}

function padDisplay(s, w) {
  // ANSI 转义不计入可视宽度（粗略：直接用字符串长度即可）
  return String(s).padEnd(w);
}

// 剥离 ANSI 转义序列，拿到真实可见宽度
function visibleLen(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '').length;
}

/**
 * 构造一行卡片内容：│[indent] content  (按可见宽度补齐空格)  │
 * 用法：lines.push(cardLine(`${color('green','✓')} xxx`));
 *      lines.push(cardLine(`→ 提示...`, 3));           // sub-line
 * 关键：必须按 ANSI-剥离后的可见长度 pad，否则带 color() 的行右边界会超出 ┐。
 *
 * 宽度约定：与顶部 ┌──...──┐ 的内宽 60 (w=60) 对齐，整行总宽 62 列。
 *   顶部边框：  '┌' + 60×'─' + '┐'        = 62 列
 *   顶行(indent=1)：'│' + ' '  + content(59) + '│' = 62 ✓
 *   子行(indent=3)：'│' + '   ' + content(57) + '│' = 62 ✓
 */
function cardLine(content, indent = 1, width = 60) {
  const padBefore = ' '.repeat(indent);
  // content + 后置 pad = 总宽 62 - 1(│) - indent - 1(│) = 60 - indent
  const innerW = width - indent;
  const visLen = visibleLen(content);
  const pad = Math.max(0, innerW - visLen);
  return `│${padBefore}${content}${' '.repeat(pad)}│`;
}

/**
 * 渲染 check 输出卡片
 */
export function renderCheckCard({
  svgFile,
  identifier,
  identifierSource = 'filename',
  confidence = 'low',
  reason = '',
  nameZh = '',
  nameEn = '',
  category,
  namingResult,
  categoryResult,
  variantResult,
  meta = {},
  template,
}) {
  const lines = [];
  const w = 60;

  lines.push('');
  lines.push(`┌${'─'.repeat(w)}┐`);
  lines.push(`│ ${color('bold', `${svgFile} · 检查`.padEnd(w - 1))}│`);
  lines.push(`├${'─'.repeat(w)}┤`);

  // SVG metadata 摘要
  if (meta.inferredZh || meta.inferredEn || meta.title || meta.comments.length > 0) {
    if (meta.inferredZh) {
      lines.push(`│ ${color('gray', '📄 SVG metadata 中文名：')} ${truncate(meta.inferredZh, w - 18)}│`);
    }
    if (meta.inferredEn) {
      lines.push(`│ ${color('gray', '📄 SVG metadata 英文名：')} ${truncate(meta.inferredEn, w - 18)}│`);
    } else if (meta.title) {
      lines.push(`│ ${color('gray', '📄 SVG <title>：')} ${truncate(meta.title, w - 14)}│`);
    }
    if (meta.comments.length > 0 && !meta.inferredZh) {
      // 只在没识别到中文名时展示注释
      lines.push(`│ ${color('gray', '📄 注释：')} ${truncate(meta.comments[0], w - 8)}│`);
    }
  }

  // 命名结果
  if (namingResult?.ok) {
    lines.push(cardLine(`${color('green', '✓')} ${color('bold', 'identifier')}  ${color('cyan', identifier)}`));
  } else {
    lines.push(cardLine(`${color('red', '✗')} ${color('bold', 'identifier')}  ${color('cyan', identifier)}`));
  }
  lines.push(cardLine(`${color('dim', `（来源：${identifierSource}）`)}`, 3));

  // 置信度行（核心新增）
//   面向设计师：友好、不带技术术语
//   host agent 该看的（needs_visual_verification 等）走 --json 模式，不进卡片
  if (confidence === 'high') {
    lines.push(cardLine(`${color('green', '✓')} ${color('bold', '名字很靠谱')}`));
  } else if (confidence === 'medium') {
    lines.push(cardLine(`${color('yellow', '⚠')} ${color('bold', '名字可能不太准')}  ${color('yellow', '建议确认下形状')}`));
    lines.push(cardLine(`${color('gray', '→ 文件名带业务前缀（如 agent-/app-/h5-），未必反映图标实际形状')}`, 3));
  } else {
    lines.push(cardLine(`${color('red', '✗')} ${color('bold', '我猜不准')}  ${color('red', '请告诉 Claude 这个图标实际长什么样')}`));
    lines.push(cardLine(`${color('gray', '→ 描述一下形状（"一个青色光标"/"一个购物车"），Claude 会帮你定名')}`, 3));
    if (reason) {
      lines.push(`│   ${color('gray', truncate(`原因：${reason}`, w - 2))}│`);
    }
  }

  // metadata 缺失警告
  const hasAnyMeta = meta.inferredZh || meta.inferredEn || meta.title || meta.dataName;
  if (!hasAnyMeta && identifierSource === 'filename') {
    lines.push(cardLine(`${color('yellow', '⚠')} SVG 内无 metadata（title/desc/中文注释都没有）`));
    lines.push(cardLine(`${color('gray', '→ 请在 Figma 组件命名，或 SVG 里加 <title>/<desc>/注释')}`, 3));
    lines.push(cardLine(`${color('gray', '  否则只能根据文件名猜，请人工确认 identifier 是否反映图标真实形状')}`, 3));
  }
  for (const err of namingResult?.errors || []) {
    lines.push(cardLine(`${color('red', '·')} ${truncate(err, w - 4)}`, 3));
  }
  for (const warn of namingResult?.warnings || []) {
    lines.push(cardLine(`${color('yellow', '·')} ${truncate(warn, w - 4)}`, 3));
  }
  for (const sug of namingResult?.suggestions || []) {
    lines.push(cardLine(`${color('cyan', '→')} ${truncate(sug, w - 4)}`, 3));
  }

  // 分类结果
  if (categoryResult) {
    lines.push(cardLine(`${color('green', '✓')} ${color('bold', '分类建议')}  ${color('bold', categoryResult.primary)}`));
    lines.push(cardLine(`${color('gray', categoryResult.rationale)}`, 3));
  }

  // 变体结果
  const variants = variantResult?.issues || [];
  if (variants.length === 0) {
    lines.push(cardLine(`${color('green', '✓')} ${color('bold', '变体检查')}  无问题`));
  } else {
    const errors = variants.filter((v) => v.severity === 'error');
    const warns = variants.filter((v) => v.severity === 'warn');
    const icon = errors.length > 0 ? color('red', '✗') : color('yellow', '⚠');
    lines.push(cardLine(`${icon} ${color('bold', '变体检查')}  ${errors.length} 错 ${warns.length} 警`));
    for (const v of variants) {
      const c = v.severity === 'error' ? 'red' : v.severity === 'warn' ? 'yellow' : 'gray';
      const prefix = v.severity === 'error' ? '✗' : v.severity === 'warn' ? '⚠' : 'ℹ';
      lines.push(cardLine(`${color(c, prefix)} ${truncate(v.message, w - 5)}`, 3));
      lines.push(cardLine(`${color('gray', truncate('→ ' + v.suggestion, w - 5))}`, 5));
    }
  }

  // 模板
  if (template) {
    lines.push(`├${'─'.repeat(w)}┤`);
    lines.push(cardLine(`${color('bold', '📋 IconPark 组件配置粘贴文本：')}`));
    for (const line of template.split('\n')) {
      lines.push(cardLine(`${color('gray', truncate(line, w - 4))}`, 3));
    }
  }

  lines.push(`└${'─'.repeat(w)}┘`);
  lines.push('');
  return lines.join('\n');
}

/**
 * 渲染 recommend 输出
 */
export function renderRecommendCard({ chineseName, candidates = [], unrecognized = [], category }) {
  const lines = [];
  lines.push('');
  lines.push(`${color('bold', `💡 "${chineseName}" 的 identifier 推荐`)}${category ? `  ${color('gray', `[${category}]`)}` : ''}`);
  lines.push('');

  if (unrecognized.length > 0) {
    lines.push(`  ${color('yellow', '⚠ 未识别中文：')} ${unrecognized.join('、')}`);
    lines.push(`    请补充 mapping 或手动调整 identifier`);
    lines.push('');
  }

  if (candidates.length === 0) {
    lines.push(`  ${color('gray', '（无候选）')}`);
  } else {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const valid = c.valid ? color('green', '✓') : color('red', '✗');
      lines.push(`  ${valid} ${color('cyan', c.identifier)}`);
      lines.push(`      ${color('gray', c.reason)}`);
      if (c.warnings?.length > 0) {
        for (const w of c.warnings) {
          lines.push(`      ${color('yellow', '⚠')} ${w}`);
        }
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}