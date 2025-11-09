/**
 * 簡體中文轉繁體中文
 * 針對台灣地址常見的字詞進行轉換
 */

const simplifiedToTraditionalMap: Record<string, string> = {
  // 常見地名用字
  台: '臺',
  台北: '臺北',
  台中: '臺中',
  台南: '臺南',
  台東: '臺東',
  湾: '灣',

  // 常見簡體字轉換
  县: '縣',
  区: '區',
  镇: '鎮',
  乡: '鄉',
  村: '村',
  路: '路',
  街: '街',
  巷: '巷',
  弄: '弄',
  号: '號',
  楼: '樓',
  层: '層',
  室: '室',

  // 方位詞
  东: '東',
  西: '西',
  南: '南',
  北: '北',
  中: '中',

  // 其他常見字
  桥: '橋',
  里: '里',
  邻: '鄰',
  栋: '棟',
  单元: '單元',
  门牌: '門牌',
  铁路: '鐵路',
  车站: '車站',
  机场: '機場',
  码头: '碼頭',
  医院: '醫院',
  学校: '學校',
  公园: '公園',
  广场: '廣場',
  市场: '市場',
  体育: '體育',
  图书: '圖書',
  邮局: '郵局',
  银行: '銀行',
  饭店: '飯店',
  旅馆: '旅館',
  宾馆: '賓館',
  酒店: '酒店',
  商场: '商場',
  超市: '超市',
  便利店: '便利商店',
};

/**
 * 將簡體中文地址轉換為繁體中文
 * @param text - 原始文字（可能包含簡體字）
 * @returns 繁體中文文字
 */
export function convertToTraditional(text: string): string {
  if (!text) return text;

  let result = text;

  // 使用對照表進行轉換
  for (const [simplified, traditional] of Object.entries(simplifiedToTraditionalMap)) {
    // 使用全局替換
    result = result.replace(new RegExp(simplified, 'g'), traditional);
  }

  return result;
}

/**
 * 清理並標準化地址格式
 * @param address - 原始地址
 * @returns 清理後的地址
 */
export function normalizeAddress(address: string): string {
  if (!address) return address;

  // 先轉換繁體
  let normalized = convertToTraditional(address);

  // 移除多餘空格
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}
