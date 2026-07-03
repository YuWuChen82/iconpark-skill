// ~/.claude/skills/iconpark/lib/svg-metadata.js
// 从 SVG 文件中提取设计师填入的 metadata
//  - <title>...</title>  （Figma 导出常见）
//  - <desc>...</desc>
//  - <!-- ... -->        （注释中常带中文名/分组/标签）
//  - data-name / data-zh / data-en 属性
//
// 这些是判断「这个图标应该叫什么名字」的最可靠依据，必须优先于文件名推断。

/**
 * 解析 SVG 文本中的 metadata
 * @param {string} svgContent
 * @returns {{
 *   title: string|null,
 *   desc: string|null,
 *   comments: string[],
 *   dataName: string|null,
 *   dataZh: string|null,
 *   dataEn: string|null,
 *   inferredZh: string|null,   // 兜底：从注释/title/desc 推断最可能的中文名
 *   inferredEn: string|null,   // 兜底：从注释/title/desc 推断最可能的英文名
 * }}
 */
export function extractSvgMetadata(svgContent) {
  if (!svgContent) {
    return emptyMeta();
  }

  const title = matchFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, svgContent);
  const desc = matchFirst(/<desc[^>]*>([\s\S]*?)<\/desc>/i, svgContent);
  const dataName = matchAttr(/data-name="([^"]+)"/i, svgContent);
  const dataZh = matchAttr(/data-zh="([^"]+)"/i, svgContent);
  const dataEn = matchAttr(/data-en="([^"]+)"/i, svgContent);

  // 注释（含 Figma 元数据：节点 ID、组件名等）
  const comments = [];
  const commentRe = /<!--([\s\S]*?)-->/g;
  let m;
  while ((m = commentRe.exec(svgContent)) !== null) {
    const txt = m[1].trim();
    if (txt) comments.push(txt);
  }

  // 兜底推断：优先取 data-name / title，去掉 Figma 节点 ID 后缀（_xxxx_xxxxx）
  let inferredEn = dataEn || dataName || title;
  if (inferredEn) {
    inferredEn = String(inferredEn)
      .replace(/\s*\d{2,}[_-]\d{3,}.*$/, '')   // 去掉 Figma 节点 ID 后缀
      .replace(/\s*\[\d+\].*$/, '')            // 去掉 [1234] 这种副本后缀
      .trim();
  }

  // 中文名：先 dataZh，再 desc，再从注释/title 里挑含中文的部分
  let inferredZh = dataZh;
  if (!inferredZh && desc) inferredZh = desc;
  if (!inferredZh && title && /[一-龥]/.test(title)) inferredZh = title;
  if (!inferredZh) {
    for (const c of comments) {
      if (/[一-龥]/.test(c)) {
        // 注释里中文通常带「名称: xxx」或「中文名: xxx」之类
        const zhMatch = c.match(/(?:中文名|名称|名|标题)[::\s]+([^\n\r,，]+)/);
        inferredZh = zhMatch ? zhMatch[1].trim() : pickChineseSegment(c);
        if (inferredZh) break;
      }
    }
  }

  return {
    title: title || null,
    desc: desc || null,
    comments,
    dataName: dataName || null,
    dataZh: dataZh || null,
    dataEn: dataEn || null,
    inferredZh: inferredZh || null,
    inferredEn: inferredEn || null,
  };
}

function emptyMeta() {
  return {
    title: null, desc: null, comments: [], dataName: null,
    dataZh: null, dataEn: null, inferredZh: null, inferredEn: null,
  };
}

function matchFirst(re, s) {
  const m = s.match(re);
  return m ? m[1].trim() : null;
}

function matchAttr(re, s) {
  const m = s.match(re);
  return m ? m[1].trim() : null;
}

function pickChineseSegment(s) {
  // 取第一个中文词组（连续中文字符 + 可选标点）
  const m = s.match(/[一-龥][一-龥\s/、·\-（）()A-Za-z0-9]{1,30}/);
  return m ? m[0].trim() : null;
}

/**
 * 给定 metadata + 文件名，构造建议的 identifier（基于 SVG 内 metadata 优先）
 * @returns { identifier: string, source: 'metadata'|'filename'|'chinese', confidence: 'high'|'medium'|'low' }
 */
export function suggestIdentifierFromMeta(meta, filename) {
  // 1) metadata 里有英文 → 直接 kebab-case
  if (meta.inferredEn) {
    const cleaned = meta.inferredEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (cleaned.length >= 2) {
      return { identifier: cleaned, source: 'metadata', confidence: 'high' };
    }
  }

  // 2) metadata 里有中文 → 让调用方走中文 mapping 推荐
  if (meta.inferredZh) {
    return { identifier: null, source: 'chinese', confidence: 'high', chineseName: meta.inferredZh };
  }

  // 3) 兜底：用文件名
  return { identifier: null, source: 'filename', confidence: 'low' };
}