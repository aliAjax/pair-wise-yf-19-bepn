// 植物标本馆 · 除虫封柜台 数据模型

export type Tier = "A" | "B" | "C";
export type IdStatus = "confirmed" | "doubt";

/** 除虫记录（标本释放柜位后仍需保留） */
export interface PestRecord {
  id: string;
  at: string;
  method: string;
  operator: string;
}

/** 柜位占用记录（完整进出历史） */
export interface PlacementRecord {
  id: string;
  cabinetId: string;
  cabinetName: string;
  sealedAt: string;
  releasedAt: string | null;
  reason: string | null;
}

export interface Specimen {
  id: string;
  collectionNo: string; // 采集号
  species: string; // 物种
  location: string; // 地点
  altitude: string; // 海拔
  habitat: string; // 生境
  tier: Tier; // 温湿度需求档
  pressed: boolean; // 是否已压制
  idStatus: IdStatus; // 鉴定状态
  pestRecords: PestRecord[]; // 除虫记录
  cabinetId: string | null; // 当前柜位
  placements: PlacementRecord[]; // 柜位记录
}

export interface Batch {
  id: string;
  name: string;
  note: string;
  reviewed: boolean; // 整批复核是否通过
  specimenIds: string[];
}

export interface Cabinet {
  id: string;
  name: string;
  tier: Tier;
  capacity: number;
  desc: string;
}

export type LogKind = "success" | "error" | "warn" | "info";

export interface LogEntry {
  id: string;
  at: string;
  kind: LogKind;
  action: string;
  detail: string;
}

export interface AppState {
  batches: Batch[];
  cabinets: Cabinet[];
  specimens: Specimen[];
  logs: LogEntry[];
  lastSyncedAt: string | null;
}

/** 标本可编辑字段 */
export type SpecimenPatch = Partial<
  Pick<
    Specimen,
    | "collectionNo"
    | "species"
    | "location"
    | "altitude"
    | "habitat"
    | "tier"
    | "pressed"
    | "idStatus"
  >
>;

export const TIER_LABEL: Record<Tier, string> = {
  A: "A档 · 低温干燥 10–14℃ / 35–45%RH",
  B: "B档 · 恒温恒湿 16–20℃ / 45–55%RH",
  C: "C档 · 常温干燥 20–25℃ / 40–50%RH",
};

export const TIER_SHORT: Record<Tier, string> = {
  A: "A · 低温干燥",
  B: "B · 恒温恒湿",
  C: "C · 常温干燥",
};
