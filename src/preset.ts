import type { AppState, Cabinet, Specimen } from "./types";

// —— 预置三个柜位 ——
export const PRESET_CABINETS: Cabinet[] = [
  {
    id: "cab-a1",
    name: "柜 A-01",
    tier: "A",
    capacity: 3,
    desc: "低温干燥柜，适合高山冷凉带标本",
  },
  {
    id: "cab-b1",
    name: "柜 B-01",
    tier: "B",
    capacity: 2,
    desc: "恒温恒湿柜，适合亚热带林下标本",
  },
  {
    id: "cab-c1",
    name: "柜 C-01",
    tier: "C",
    capacity: 3,
    desc: "常温干燥柜，适合一般腊叶标本",
  },
];

// —— 预置三批标本 ——
export const PRESET_SPECIMENS: Specimen[] = [
  // 第一批：合格批次，A 档 ×2，正好可入 A-01
  {
    id: "sp-01",
    collectionNo: "HX-20260901-01",
    species: "长柄双花木 Disanthus cercidifolius",
    location: "湖南 莽山国家级自然保护区",
    altitude: "1280 m",
    habitat: "山地阔叶林下阴湿溪沟边",
    tier: "A",
    pressed: true,
    idStatus: "confirmed",
    pestRecords: [],
    cabinetId: null,
    placements: [],
  },
  {
    id: "sp-02",
    collectionNo: "HX-20260901-02",
    species: "华南五针松 Pinus kwangtungensis",
    location: "湖南 莽山 猛坑石",
    altitude: "1610 m",
    habitat: "山脊矮林岩石缝隙",
    tier: "A",
    pressed: true,
    idStatus: "confirmed",
    pestRecords: [],
    cabinetId: null,
    placements: [],
  },
  // 第二批：合格批次，B 档 ×2，可占满 B-01
  {
    id: "sp-03",
    collectionNo: "HX-20260905-11",
    species: "金毛狗 Cibotium barometz",
    location: "广东 南岭 小黄山",
    altitude: "520 m",
    habitat: "亚热带常绿阔叶林缘酸性红壤",
    tier: "B",
    pressed: true,
    idStatus: "confirmed",
    pestRecords: [],
    cabinetId: null,
    placements: [],
  },
  {
    id: "sp-04",
    collectionNo: "HX-20260905-12",
    species: "福建柏 Fokienia hodginsii",
    location: "广东 南岭 瀑布群景区",
    altitude: "640 m",
    habitat: "溪谷旁湿润常绿阔叶林中",
    tier: "B",
    pressed: true,
    idStatus: "confirmed",
    pestRecords: [],
    cabinetId: null,
    placements: [],
  },
  // 第三批：含两份不合格（一份未压制、一份鉴定存疑），整批复核必须退回
  {
    id: "sp-05",
    collectionNo: "HX-20260908-21",
    species: "山橿 Lindera reflexa",
    location: "浙江 天目山 禅源寺后山",
    altitude: "430 m",
    habitat: "毛竹林与阔叶林交界缓坡",
    tier: "C",
    pressed: true,
    idStatus: "confirmed",
    pestRecords: [],
    cabinetId: null,
    placements: [],
  },
  {
    id: "sp-06",
    collectionNo: "HX-20260908-22",
    species: "悬钩子属 待定 Rubus sp.",
    location: "浙江 天目山 倒挂莲花峰",
    altitude: "760 m",
    habitat: "林缘路边灌丛",
    tier: "C",
    pressed: true,
    idStatus: "doubt", // 鉴定存疑
    pestRecords: [],
    cabinetId: null,
    placements: [],
  },
  {
    id: "sp-07",
    collectionNo: "HX-20260908-23",
    species: "翠雀叶蟹甲草 Parasenecio delphiniphyllus",
    location: "浙江 天目山 仙人顶",
    altitude: "1480 m",
    habitat: "山顶草甸湿润处",
    tier: "C",
    pressed: false, // 未压制
    idStatus: "confirmed",
    pestRecords: [],
    cabinetId: null,
    placements: [],
  },
];

export const PRESET_BATCHES: AppState["batches"] = [
  {
    id: "batch-1",
    name: "第一批 · 莽山采集",
    note: "2026-09-01 湖南莽山，2 份，均为 A 档需求",
    reviewed: false,
    specimenIds: ["sp-01", "sp-02"],
  },
  {
    id: "batch-2",
    name: "第二批 · 南岭采集",
    note: "2026-09-05 广东南岭，2 份，均为 B 档需求",
    reviewed: false,
    specimenIds: ["sp-03", "sp-04"],
  },
  {
    id: "batch-3",
    name: "第三批 · 天目山采集",
    note: "2026-09-08 浙江天目山，3 份 C 档；含未压制与鉴定存疑各 1 份",
    reviewed: false,
    specimenIds: ["sp-05", "sp-06", "sp-07"],
  },
];

export function buildPresetState(): AppState {
  return {
    batches: PRESET_BATCHES.map((b) => ({ ...b, specimenIds: [...b.specimenIds] })),
    cabinets: PRESET_CABINETS.map((c) => ({ ...c })),
    specimens: PRESET_SPECIMENS.map((s) => ({
      ...s,
      pestRecords: [],
      cabinetId: null,
      placements: [],
    })),
    logs: [
      {
        id: "log-init",
        at: nowText(),
        kind: "info",
        action: "系统预置",
        detail: "已预置 3 批标本（共 7 份）与 3 个柜位，等待整批复核。",
      },
    ],
    lastSyncedAt: null,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function nowText(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let idSeq = 0;
export function uid(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}
