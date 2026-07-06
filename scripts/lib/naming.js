// ~/.claude/skills/iconpark/lib/naming.js
// 命名校验 + 中文→identifier 映射推荐

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'assets', 'data');

const NAMING_RE = /^jc-icon-[a-z][a-z0-9-]{1,28}(-lined|-filled|-colored|-gradient)?$/;
const PREFIX = 'jc-icon-';

let _examples = null;

async function loadExamples() {
  if (_examples) return _examples;
  const raw = await fs.readFile(path.join(DATA_DIR, 'bad-name-examples.json'), 'utf8');
  _examples = JSON.parse(raw).examples;
  return _examples;
}

// 常用中文→英文映射。覆盖业务高频词；不覆盖的视为未识别，触发警告。
const ZH_MAPPING = {
  // 基础操作
  '新增': 'add', '添加': 'add', '删除': 'delete', '移除': 'remove',
  '编辑': 'edit', '修改': 'edit', '搜索': 'search', '查找': 'search',
  '设置': 'setting', '配置': 'setting', '刷新': 'refresh', '更新': 'refresh',
  '更多': 'more', '关闭': 'close', '取消': 'close', '确认': 'confirm',
  '加': 'plus', '减': 'minus', '复制': 'copy', '粘贴': 'paste',
  '剪切': 'cut', '撤销': 'undo', '重做': 'redo', '保存': 'save',
  '清空': 'clear', '重置': 'reset', '选择': 'select',
  '点击': 'click', '单击': 'click', '双击': 'double-click', '长按': 'long-press',
  '拖动': 'drag', '拖拽': 'drag', '滑动': 'swipe', '滚动': 'scroll',
  '操作': 'action', '动作': 'action', '手势': 'gesture',
  '展开': 'expand', '收起': 'collapse', '折叠': 'fold', '放大': 'zoom-in',
  '缩小': 'zoom-out', '旋转': 'rotate', '翻转': 'flip',
  // 用户/账户
  '用户': 'user', '账号': 'account', '账户': 'account',
  '个人': 'profile', '资料': 'profile', '会员': 'member',
  '团队': 'team', '组织': 'organization', '企业': 'enterprise',
  '权限': 'permission', '角色': 'role',
  // 导航
  '首页': 'home', '主页': 'home', '返回': 'back', '前进': 'forward',
  '菜单': 'menu', '列表': 'list', '详情': 'detail', '设置页': 'settings',
  // 评价/社交
  '点赞': 'like', '喜欢': 'like', '收藏': 'favorite', '评分': 'rate',
  '评论': 'comment', '回复': 'reply', '分享': 'share', '关注': 'follow',
  '订阅': 'subscribe', '消息': 'message', '通知': 'notification',
  '聊天': 'chat', '会话': 'conversation', '好友': 'friend',
  // 媒体
  '图片': 'image', '照片': 'photo', '视频': 'video', '音频': 'audio',
  '音乐': 'music', '语音': 'voice', '文件': 'file', '文档': 'document',
  '文件夹': 'folder', '相册': 'album', '相机': 'camera',
  // 通讯
  '邮件': 'mail', '邮箱': 'mail', '电话': 'phone', '手机': 'mobile',
  '短信': 'sms', '验证码': 'code', '二维码': 'qrcode',
  // 工具/状态
  '信息': 'info', '提示': 'tips', '帮助': 'help', '关于': 'about',
  '警告': 'warning', '错误': 'error', '失败': 'fail', '成功': 'success',
  '完成': 'done', '加载': 'loading', '等待': 'loading', '同步': 'sync',
  '下载': 'download', '导出': 'export', '上传': 'upload', '导入': 'import',
  '打印': 'print', '全屏': 'fullscreen', '锁定': 'lock', '解锁': 'unlock',
  // 装饰/特殊
  '星星': 'star', '星形': 'star', '星': 'star', '收藏夹': 'favorite',
  '闪光': 'sparkle', '闪光点': 'sparkle', '点缀': 'sparkle', '魔法': 'magic',
  '爱心': 'heart', '心': 'heart', '皇冠': 'crown', '勋章': 'medal',
  '礼物': 'gift', '活动': 'activity', '促销': 'promotion',
  '光标': 'cursor', '指针': 'cursor', '鼠标': 'cursor', '手型': 'hand', '手势': 'gesture',
  '波纹': 'ripple', '辐射': 'ripple', '点击波': 'click-ripple',
  // 时间/位置
  '日历': 'calendar', '日期': 'date', '时间': 'time', '时钟': 'clock',
  '标签': 'tag', '标签页': 'tab', '徽章': 'badge',
  '拍照': 'camera', '拍摄': 'camera', '摄影': 'camera', '录像': 'record', '直播': 'live',
  '地图': 'map', '位置': 'location', '定位': 'location', '导航': 'navigation',
  '路线': 'route', '地址': 'address',
  // 商业
  '购物车': 'shopping-cart', '购物': 'shopping', '订单': 'order',
  '支付': 'payment', '钱包': 'wallet', '优惠券': 'coupon', '发票': 'invoice',
  '商品': 'product', '价格': 'price', '库存': 'stock',
  // 图表/数据
  '图表': 'chart', '数据': 'data', '表格': 'table', '趋势': 'trend',
  '统计': 'statistics', '报表': 'report', '分析': 'analytics',
  // 形状/方向
  '箭头': 'arrow', '上': 'up', '下': 'down', '左': 'left', '右': 'right',
  '上箭头': 'arrow-up', '下箭头': 'arrow-down', '左箭头': 'arrow-left',
  '右箭头': 'arrow-right',
  '三角形': 'triangle', '圆形': 'circle', '方形': 'square',
  '矩形': 'rectangle', '菱形': 'diamond', '星形': 'star',

  // 鼠标 / 光标 / 手势 变体（光标/指针/鼠标 → cursor 已在上面）
  '鼠标右键': 'cursor-right', '鼠标左键': 'cursor-left', '鼠标中键': 'cursor-middle',
  '箭头光标': 'cursor', '拖动手柄': 'drag-handle',

  // 商业扩展（购物车/订单/支付/钱包/商品 等已在上面，仅补新增）
  '购物袋': 'shopping-bag', '店铺': 'shop',

  // 状态/奖励 扩展（礼物/皇冠/勋章 等已在上面，仅补新增）
  '奖牌': 'medal', '奖杯': 'trophy', '火箭': 'rocket', '小心心': 'heart',

  // like 别名（与点赞重复，加一条方便从中文名输入）
  '喜爱': 'like', '赞': 'like',
};

/**
 * 检测输入中是否有中文
 */
function hasChinese(s) {
  return /[一-龥]/.test(s);
}

/**
 * 把中文名拆成 (识别到的英文 tokens, 未识别的中文字符列表)
 * 命中规则：长词优先，避免 "星" 抢匹配 "星星"
 * 中文里夹的英文（如 "Agent点击"）会保留为 token，业务前缀在前
 */
function tokenizeChinese(chineseName) {
  const recognized = new Set();
  const tokens = [];

  // 1) 先抽"中文里夹的英文"，作为业务前缀在最前
  //    例如 "Agent点击" → 先得 "agent"
  const englishOnly = chineseName
    .replace(/[一-龥]/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
  const englishTokens = englishOnly
    ? englishOnly.split(/\s+/).filter(Boolean)
    : [];

  // 2) 再抽中文 mapping 命中（按映射键字符数降序，避免短词抢匹配）
  const sortedKeys = Object.keys(ZH_MAPPING).sort((a, b) => b.length - a.length);
  let remaining = chineseName;
  for (const zh of sortedKeys) {
    if (remaining.includes(zh)) {
      tokens.push(ZH_MAPPING[zh]);
      for (const c of zh) recognized.add(c);
      remaining = remaining.split(zh).join(' ');
    }
  }

  // 3) 业务前缀（英文）放最前，中文映射结果在后
  const ordered = [...englishTokens, ...tokens];

  // 4) 找出未识别的中文字符
  const allChinese = new Set((chineseName.match(/[一-龥]/g)) || []);
  const unrecognized = [];
  for (const c of allChinese) {
    if (!recognized.has(c)) unrecognized.push(c);
  }

  return { tokens: ordered, unrecognized };
}

/**
 * 校验单个 identifier
 */
export async function validateIdentifier(identifier) {
  const errors = [];
  const warnings = [];
  const suggestions = [];

  if (!identifier) {
    errors.push('identifier 不能为空');
    return { ok: false, errors, warnings, suggestions };
  }

  if (!identifier.startsWith(PREFIX)) {
    errors.push(`缺少前缀 ${PREFIX}`);
    suggestions.push(`${PREFIX}${identifier.replace(/[^a-z0-9-]/g, '')}`);
  }

  const body = identifier.startsWith(PREFIX)
    ? identifier.slice(PREFIX.length)
    : identifier;

  if (!body || body.length < 2) {
    errors.push(`identifier 主体至少 2 个字符`);
  }
  if (body.length > 30) {
    errors.push(`identifier 主体不能超过 30 字符（当前 ${body.length}）`);
  }

  if (identifier.startsWith(PREFIX) && !NAMING_RE.test(identifier)) {
    if (!errors.length) {
      errors.push(`格式不规范：必须小写字母 + 数字 + 连字符，可选 -lined/-filled/-colored/-gradient 后缀`);
    }
  }

  // 反例词典匹配
  const examples = await loadExamples();
  for (const ex of examples) {
    if (ex.bad === identifier) {
      warnings.push(`反例词典命中：${ex.reason}`);
      suggestions.push(ex.good);
      break;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * 根据中文名生成候选 identifier
 * @returns {Promise<{candidates: Array<{identifier: string, reason: string, valid: boolean, warnings: string[]}>, unrecognized: string[]}>}
 */
export async function recommendIdentifiers(chineseName, category) {
  if (!chineseName) return { candidates: [], unrecognized: [] };

  const { tokens, unrecognized } = tokenizeChinese(chineseName);

  // 形态后缀
  const suffixMap = {
    '常规线性': '',
    '高频线性': '',
    '填充色': '-filled',
    '渐变色': '-gradient',
    '品牌填充色': '-filled',
    '定色': '-colored',
    'iconfont 迁移': '',
  };
  const suffix = suffixMap[category] || '';

  const candidates = [];
  const seen = new Set();

  // 候选 1：完整拼接（基于识别到的英文 tokens）
  if (tokens.length > 0) {
    const cand = `${PREFIX}${tokens.join('-')}${suffix}`;
    if (!seen.has(cand)) {
      candidates.push({ identifier: cand, reason: '基于中文名直译' });
      seen.add(cand);
    }
  }

  // 候选 2：去冗余（保留第一个 token）
  if (tokens.length > 1) {
    const cand = `${PREFIX}${tokens[0]}${suffix}`;
    if (!seen.has(cand)) {
      candidates.push({ identifier: cand, reason: '最简形态，去冗余' });
      seen.add(cand);
    }
  }

  // 候选 3：若输入含未识别中文，提示并给出 untitled 占位
  if (unrecognized.length > 0) {
    const cand = `${PREFIX}untitled${suffix}`;
    if (!seen.has(cand)) {
      candidates.push({
        identifier: cand,
        reason: `未识别中文：${unrecognized.join('')}，已用 untitled 占位`,
      });
      seen.add(cand);
    }
  }

  // 全部为空时给一个占位
  if (candidates.length === 0) {
    candidates.push({
      identifier: `${PREFIX}untitled${suffix}`,
      reason: '无候选，使用占位名',
    });
  }

  // 校验每个候选
  const validated = await Promise.all(
    candidates.map(async (c) => {
      const v = await validateIdentifier(c.identifier);
      return { ...c, valid: v.ok, warnings: v.warnings };
    })
  );

  return { candidates: validated, unrecognized };
}

export const PREFIX_CONST = PREFIX;

// ============================================================
//  filename 清洗工具 + 置信度
// ============================================================

/** 去除 .svg 扩展名 */
export function stripExt(name) {
  return String(name).replace(/\.svg$/i, '');
}

/** 去除 4 位年份后缀（-2026, _2024, 2026） */
export function stripYearSuffix(name) {
  return String(name).replace(/[_-]?(19|20)\d{2}$/i, '');
}

/** 去除版本/状态后缀（-v1, -v2.0, -final, -draft, -copy, -副本 等） */
export function stripVersionSuffix(name) {
  return String(name).replace(
    /[_-](v\d+(\.\d+)*|final|draft|alpha|beta|rc\d*|copy|副本|最终版?|草稿|new|旧)$/i,
    ''
  );
}

/** 去除常见业务前缀（保守：只去明确不是图标语义的；只在带分隔符时去除） */
export function stripProjectPrefix(name) {
  return String(name).replace(/^(agent|app|web|h5|mini|jd|jc|alibaba|bytedance)[_-]/i, '');
}

/**
 * filename 清洗链：扩展名 → 项目前缀 → 版本后缀 → 年份后缀
 * 任何一步失败不影响后续步骤；返回最终 cleaned body（不含 jc-icon- 前缀）
 */
export function cleanFilename(filename) {
  return stripYearSuffix(
    stripVersionSuffix(stripProjectPrefix(stripExt(filename)))
  );
}

/**
 * 把清洗后的 body 拼成完整 identifier
 * - 含中文：走 ZH_MAPPING 推荐，不在此函数处理
 * - 纯英文/数字：kebab-case 后加前缀
 */
export function identifierFromCleaned(cleaned) {
  if (!cleaned) return null;
  const kebab = String(cleaned)
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
  if (!kebab) return null;
  if (kebab.startsWith('jc-icon-')) return kebab;
  return `${PREFIX}${kebab}`;
}

/** 导出 hasChinese + tokenizeChinese（template.js 中文路径需要） */
export { hasChinese, tokenizeChinese };

/**
 * 计算置信度
 * @param {object} opts
 * @param {string} opts.filename 原始文件名（含扩展名）
 * @param {object} [opts.meta]   svg-metadata.js 的 extractSvgMetadata 结果
 * @returns {'high' | 'medium' | 'low'}
 *
 * 规则：
 *   high:   SVG metadata 里有明确的英文/中文名（metadata 是设计源头，最可信）
 *   medium: 仅靠文件名推断（CLI 不识图，文件名可能是场景前缀）
 *   low:    文件名清洗后无内容 / 含未识别中文 / 完全没有信号
 */
export function computeConfidence({ filename, meta } = {}) {
  // 1) metadata 有 explicit 英文名 → high
  if (meta?.inferredEn && String(meta.inferredEn).length >= 2) return 'high';

  // 2) metadata 有中文且全部命中 ZH_MAPPING → high
  if (meta?.inferredZh) {
    const { unrecognized } = tokenizeChinese(meta.inferredZh);
    if (unrecognized.length === 0) return 'high';
    return 'low';
  }

  if (!filename) return 'low';

  // 3) 文件名含中文：CLI 不识图，最多 medium（即使命中 mapping 也是猜）
  if (hasChinese(filename)) {
    const base = stripExt(filename);
    const { tokens, unrecognized } = tokenizeChinese(base);
    if (tokens.length > 0 && unrecognized.length === 0) return 'medium';
    if (tokens.length > 0) return 'low';
    return 'low';
  }

  // 4) 纯英文文件名：清洗后剩余 token（CLI 不识图，最多 medium）
  const cleaned = cleanFilename(filename);
  const kebab = identifierFromCleaned(cleaned);
  if (kebab) return 'medium'; // 清洗后能产出有效 identifier
  return 'low'; // 全是 ###、空格 等无意义字符
}

/**
 * 判断 confidence 是否需要 host 做视觉识别
 */
export function needsVisualVerification(confidence) {
  return confidence !== 'high';
}