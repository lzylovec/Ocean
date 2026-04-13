export const navItems = [
  { href: "/", label: "项目首页" },
  { href: "/collect", label: "采集页" },
  { href: "/dashboard", label: "数据看板" },
  { href: "/admin/trash", label: "后台核对" },
];

export const challengePoints = [
  "水下能见度低，原始素材模糊、偏色、悬浮物干扰明显。",
  "人工识别与表单录入耗时长，错漏率高。",
  "数据分散在图片、表单、Excel、报告之间，难以联动。",
  "垃圾来源难判断，治理行动难以回到源头。",
];

export const capabilityCards = [
  {
    title: "水下慧眼",
    description: "通过图像增强模型提升清晰度，为后续识别提供高质量素材。",
  },
  {
    title: "垃圾身份证",
    description: "基于检测、OCR 和规则聚合，为每件垃圾生成可核对的数字档案。",
  },
  {
    title: "协同中枢站",
    description: "把采集、分析、展示、审核统一到一个平台，形成治理闭环。",
  },
];

export const dashboardMetrics = [
  { label: "累计潜点", value: "24", note: "覆盖 6 个重点海域" },
  { label: "识别垃圾件数", value: "1,286", note: "MVP 使用模拟数据" },
  { label: "高风险热点", value: "7", note: "近岸旅游和渔业混合区域" },
  { label: "志愿者反馈标签", value: "19", note: "支持自动聚合与复核" },
];

export const sourceInsights = [
  "塑料瓶和包装袋集中出现在旅游岸线和近岸休闲海域。",
  "废弃渔网与绳索更接近作业渔区和船只停泊带。",
  "重复出现的热点点位需要配合季节风向与潮汐做源头拦截。",
];

export const trashIdentitySamples = [
  {
    id: "TI-2026-001",
    category: "塑料瓶",
    material: "PET",
    site: "深圳湾东潜点",
    source: "旅游及岸线消费",
    confidence: "0.91",
    status: "待复核",
  },
  {
    id: "TI-2026-002",
    category: "废弃渔网",
    material: "尼龙",
    site: "外伶仃北坡",
    source: "近岸渔业作业",
    confidence: "0.86",
    status: "已确认",
  },
  {
    id: "TI-2026-003",
    category: "金属易拉罐",
    material: "铝",
    site: "三亚礁盘区",
    source: "岸线消费与海流输入",
    confidence: "0.78",
    status: "待补 OCR",
  },
];

export const volunteerTags = [
  "能见度差",
  "渔具类",
  "重复污染点",
  "塑料包装",
  "需联动岸线巡查",
];
