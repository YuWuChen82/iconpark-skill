// ~/.claude/skills/iconpark/lib/variant-detect.js
// 检测 SVG 中的硬编码颜色 / 非标尺寸 / 透明度 / 端点 / 线宽 等变体问题
// 依据：《IconPark 绘制规范 - 公开版》(bytedance.larkoffice.com/docx/Reevd7eDsoVx5zxPUBhc9Ga7nEe)
//      + IconPark 仓库 README（颜色勾选工具基于 fill="#xxx" 十六进制扫描）

/**
 * 检测 SVG 中的变体问题
 * @param {string} svgContent - 原始 SVG 字符串
 * @param {object} [opts]
 * @param {string} [opts.category] - 分类。彩色类（定色/品牌填充色/渐变色/填充色）允许彩色。
 * @returns {{issues: Array<{type: string, severity: 'warn'|'error'|'info', message: string, suggestion: string}>}}
 */
export function detectVariants(svgContent, opts = {}) {
  const issues = [];
  const { category } = opts;
  const colorAllowed = ['定色', '品牌填充色', '渐变色', '填充色'].includes(category);

  // === 颜色识别 ===
  // IconPark 后台"勾选需要变化的填充/描边颜色"工具扫描的是
  // fill="#xxx" stroke="#xxx" 这种具体十六进制颜色值（参考仓库 README：
  // outline 用 fill="#000000"、filled 用 fill="#333"、multi-color 用 ['#333','#2F88FF','#FFF','#43CCF8']）。
  // `currentColor` / 颜色名 / url(#xxx) 都不会被该工具识别为"颜色"。
  const fillRegex = /fill="([^"]+)"/g;
  const strokeRegex = /stroke="([^"]+)"/g;

  const isHexColor = (c) => /^#[0-9a-fA-F]{3,8}$/.test(c);
  const isRgbColor = (c) => /^rgb\([^)]+\)$/i.test(c);

  // 仅"确实无颜色"才是中性（none / transparent / inherit）
  // 注意：currentColor 不在此列 —— 它是关键字但不会被 IconPark 后台识别
  const isNeutral = (c) =>
    c === 'none' || c === 'transparent' || c === 'inherit';

  const isWhite = (c) =>
    c === '#fff' || c === '#ffffff' ||
    c === '#FFF' || c === '#FFFFFF' ||
    c === 'white' ||
    /^rgba?\(\s*255\s*,\s*255\s*,\s*255\s*(?:,\s*[\d.]+\s*)?\)$/i.test(c);

  let match;
  while ((match = fillRegex.exec(svgContent)) !== null) {
    const raw = match[1];
    const color = raw.toLowerCase();

    if (isNeutral(color)) continue;

    // 1) currentColor / 颜色关键字：IconPark 后台颜色勾选工具不识别
    if (color === 'currentcolor' || (!isHexColor(color) && !isRgbColor(color) && !color.startsWith('url'))) {
      issues.push({
        type: 'unrecognized-fill',
        severity: colorAllowed ? 'info' : 'warn',
        message: `fill="${raw}" 不是十六进制颜色值`,
        suggestion: 'IconPark 后台"勾选需要变化的填充颜色"工具只识别 fill="#xxx" 十六进制值。常规线性建议 fill="#000" 或 fill="#000000"；彩色分类按设计稿保留具体色值',
      });
      continue;
    }

    // 2) url(#xxx) 渐变引用
    if (color.startsWith('url')) {
      issues.push({
        type: 'gradient-fill',
        severity: 'warn',
        message: `fill="${raw}" 是渐变引用`,
        suggestion: 'IconPark 后台颜色勾选工具不识别渐变引用。如需保留渐变效果，上传后跳过"勾选颜色"步骤即可；如不需要，建议改为具体十六进制色值',
      });
      continue;
    }

    // 3) 白色 fill —— 在白色背景网页端不可见
    if (isWhite(color)) {
      issues.push({
        type: 'white-fill',
        severity: 'error',
        message: `检测到白色 fill="${raw}"，在白色背景网页端不可见`,
        suggestion: '非彩色分类请用 fill="#000" 或 fill="#000000"；彩色分类改用具体彩色色值',
      });
      continue;
    }

    // 4) 具体十六进制颜色 —— IconPark 标准做法，OK
    // （不报错）
  }

  while ((match = strokeRegex.exec(svgContent)) !== null) {
    const raw = match[1];
    const color = raw.toLowerCase();

    if (isNeutral(color)) continue;

    if (color === 'currentcolor' || (!isHexColor(color) && !isRgbColor(color) && !color.startsWith('url'))) {
      issues.push({
        type: 'unrecognized-stroke',
        severity: colorAllowed ? 'info' : 'warn',
        message: `stroke="${raw}" 不是十六进制颜色值`,
        suggestion: 'IconPark 后台"勾选需要变化的描边颜色"工具只识别 stroke="#xxx" 十六进制值。建议 stroke="#000" 或 stroke="#000000"',
      });
      continue;
    }

    if (color.startsWith('url')) {
      issues.push({
        type: 'gradient-stroke',
        severity: 'warn',
        message: `stroke="${raw}" 是渐变引用`,
        suggestion: 'IconPark 后台颜色勾选工具不识别渐变引用。保留渐变需跳过"勾选颜色"步骤；不需要则改用十六进制',
      });
      continue;
    }

    if (isWhite(color)) {
      issues.push({
        type: 'white-stroke',
        severity: 'error',
        message: `检测到白色 stroke="${raw}"，在白色背景网页端不可见`,
        suggestion: '非彩色分类请用 stroke="#000" 或 stroke="#000000"；彩色分类改用具体彩色色值',
      });
      continue;
    }
  }

  // === viewBox 标准 48x48 ===
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  if (viewBoxMatch) {
    const viewBox = viewBoxMatch[1];
    const expected = '0 0 48 48';
    if (viewBox !== expected) {
      issues.push({
        type: 'non-standard-viewbox',
        severity: 'warn',
        message: `viewBox="${viewBox}" 非标准 48×48`,
        suggestion: 'IconPark 标准 viewBox 为 "0 0 48 48"。内容若偏左/偏上，可在最外层 <g> 加 transform="translate(dx dy)" 居中',
      });
    }
  } else {
    issues.push({
      type: 'missing-viewbox',
      severity: 'error',
      message: '缺少 viewBox 属性',
      suggestion: 'IconPark 要求 viewBox="0 0 48 48"',
    });
  }

  // === width / height 不应硬编码 ===
  const widthMatch = svgContent.match(/(<svg[^>]*\s)width="(\d+(?:\.\d+)?)"/);
  const heightMatch = svgContent.match(/(<svg[^>]*\s)height="(\d+(?:\.\d+)?)"/);
  if (widthMatch || heightMatch) {
    issues.push({
      type: 'hardcoded-size',
      severity: 'warn',
      message: `<svg> 上硬编码 width/height (${widthMatch?.[2] || '?'}×${heightMatch?.[2] || '?'})`,
      suggestion: '只设 viewBox，大小由代码层 size 属性控制。注意：filter 元素自身的 width/height 是 filter 区域参数，不是 svg 尺寸，不要删',
    });
  }

  // === 线宽检查（绘制规范：默认 4px） ===
  // 只对有 stroke 的图标提示
  const hasStroke = /<path[^>]*\sstroke="(?!none)/.test(svgContent);
  if (hasStroke) {
    const swMatch = svgContent.match(/stroke-width="([\d.]+)"/);
    if (swMatch) {
      const sw = parseFloat(swMatch[1]);
      if (Math.abs(sw - 4) > 0.01) {
        issues.push({
          type: 'non-standard-stroke-width',
          severity: 'info',
          message: `stroke-width="${sw}" 非默认 4px`,
          suggestion: 'IconPark 绘制规范：48x48 画布默认线宽 4px。细线/粗线场景可调整，但建议保持视觉一致',
        });
      }
    } else {
      issues.push({
        type: 'missing-stroke-width',
        severity: 'info',
        message: '未指定 stroke-width',
        suggestion: 'IconPark 绘制规范默认 4px；建议显式声明 stroke-width="4" 以保持跨场景视觉一致',
      });
    }
  }

  // === 端点检查（绘制规范：默认圆角端点） ===
  if (hasStroke) {
    const hasLinecap = /stroke-linecap="[^"]+"/.test(svgContent);
    const hasLinejoin = /stroke-linejoin="[^"]+"/.test(svgContent);
    if (!hasLinecap || !hasLinejoin) {
      issues.push({
        type: 'missing-linecap-linejoin',
        severity: 'info',
        message: '未设置 stroke-linecap / stroke-linejoin',
        suggestion: 'IconPark 绘制规范：线段端点默认与线段同宽的圆角（stroke-linecap="round" / stroke-linejoin="round"）',
      });
    }
  }

  // === opacity / fill-opacity / stroke-opacity ===
  if (/\sopacity="[^"]+"/.test(svgContent)) {
    issues.push({
      type: 'opacity',
      severity: 'warn',
      message: '检测到 opacity 属性',
      suggestion: '透明度建议用 fill-opacity / stroke-opacity，避免使用 opacity',
    });
  }

  if (/\sfill-opacity="[^"]+"/.test(svgContent) || /\sstroke-opacity="[^"]+"/.test(svgContent)) {
    issues.push({
      type: 'fill-opacity',
      severity: 'warn',
      message: '检测到 fill-opacity 或 stroke-opacity',
      suggestion: '透明度应在代码层控制，避免在 SVG 源文件固定',
    });
  }

  return { issues };
}