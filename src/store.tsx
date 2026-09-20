import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  AppState,
  Batch,
  LogEntry,
  LogKind,
  Specimen,
  SpecimenPatch,
} from "./types";
import { buildPresetState, nowText, uid } from "./preset";

// —— 本地数据同步 ——
const STORAGE_KEY = "herbarium-fume-cabinet:v1";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildPresetState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.batches || !parsed.cabinets || !parsed.specimens) {
      return buildPresetState();
    }
    return parsed;
  } catch {
    return buildPresetState();
  }
}

// —— Actions ——
export type Action =
  | {
      type: "REVIEW_BATCH";
      batchId: string;
      operator: string;
    }
  | {
      type: "PEST_TREAT";
      batchId: string;
      method: string;
      operator: string;
    }
  | {
      type: "SEAL_BATCH";
      batchId: string;
      cabinetId: string;
      operator: string;
    }
  | {
      type: "RELEASE_SPECIMEN";
      specimenId: string;
      reason: string;
      operator: string;
    }
  | {
      type: "UPDATE_SPECIMEN";
      specimenId: string;
      patch: SpecimenPatch;
      operator: string;
    }
  | { type: "RESET" };

interface ReviewResult {
  ok: boolean;
  bad: Specimen[];
}

export function reviewBatch(batch: Batch, specimens: Specimen[]): ReviewResult {
  const members = batch.specimenIds
    .map((id) => specimens.find((s) => s.id === id))
    .filter((s): s is Specimen => Boolean(s));
  const bad = members.filter((s) => !s.pressed || s.idStatus === "doubt");
  return { ok: bad.length === 0, bad };
}

export type SealRejectReason =
  | { code: "NOT_REVIEWED"; message: string }
  | { code: "NOT_TREATED"; message: string; specimens: Specimen[] }
  | { code: "INVALID_MEMBER"; message: string; specimens: Specimen[] }
  | { code: "DUP_OCCUPY"; message: string; specimens: Specimen[] }
  | { code: "TIER_MISMATCH"; message: string; specimens: Specimen[] }
  | { code: "CAPACITY"; message: string };

export interface SealCheck {
  ok: boolean;
  reasons: SealRejectReason[];
  candidates: Specimen[];
}

/**
 * 封柜前置校验（原子语义：任意一项失败 → 整柜拒绝，不写入任何占用）
 * 候选标本 = 批内“未在柜且已除虫”的标本；已在柜的标本不参与本次封入。
 */
export function checkSeal(
  batch: Batch,
  cabinetId: string,
  state: AppState
): SealCheck {
  const reasons: SealRejectReason[] = [];
  const cabinet = state.cabinets.find((c) => c.id === cabinetId);
  const members = batch.specimenIds
    .map((id) => state.specimens.find((s) => s.id === id))
    .filter((s): s is Specimen => Boolean(s));

  if (!cabinet) {
    reasons.push({ code: "CAPACITY", message: "目标柜位不存在。" });
    return { ok: false, reasons, candidates: [] };
  }

  if (!batch.reviewed) {
    reasons.push({
      code: "NOT_REVIEWED",
      message: "该批次尚未通过整批复核，不能封柜。",
    });
  }

  // 批内任何一份不合格，整批都不能封
  const invalid = members.filter((s) => !s.pressed || s.idStatus === "doubt");
  if (invalid.length > 0) {
    reasons.push({
      code: "INVALID_MEMBER",
      message: "批次中存在未压制或鉴定存疑标本，须整批退回复核。",
      specimens: invalid,
    });
  }

  const candidates = members.filter((s) => s.cabinetId === null);

  if (candidates.length === 0) {
    reasons.push({ code: "CAPACITY", message: "批内标本均已在柜，无需重复封柜。" });
  }

  const untreated = candidates.filter((s) => s.pestRecords.length === 0);
  if (untreated.length > 0) {
    reasons.push({
      code: "NOT_TREATED",
      message: "尚有标本未完成除虫，禁止封柜。",
      specimens: untreated,
    });
  }

  // 候选标本已占在【其他】柜位 → 重复占用（理论上候选均 cabinetId === null，
  // 此处对“占用柜位与目标不一致”做显式拦截）
  const dup = members.filter(
    (s) => s.cabinetId !== null && s.cabinetId !== cabinetId
  );
  if (dup.length > 0) {
    reasons.push({
      code: "DUP_OCCUPY",
      message: "批内已有标本占用其他柜位，重复占用整柜拒绝。",
      specimens: dup,
    });
  }

  // 温湿度档一致（候选标本必须与目标柜同档）
  const tierBad = candidates.filter((s) => s.tier !== cabinet.tier);
  if (tierBad.length > 0) {
    reasons.push({
      code: "TIER_MISMATCH",
      message: `存在与 ${cabinet.name}（${cabinet.tier} 档）档位不符的标本，整柜拒绝。`,
      specimens: tierBad,
    });
  }

  // 容量足够（柜内已有占用 + 本次拟入数量）
  const occupyNow = state.specimens.filter(
    (s) => s.cabinetId === cabinetId
  ).length;
  const want = candidates.length;
  if (want > 0 && occupyNow + want > cabinet.capacity) {
    reasons.push({
      code: "CAPACITY",
      message: `${cabinet.name} 容量 ${cabinet.capacity}，现占用 ${occupyNow}，本次需封入 ${want}，无法容纳，整柜拒绝。`,
    });
  }

  return { ok: reasons.length === 0, reasons, candidates };
}

function makeLog(kind: LogKind, action: string, detail: string): LogEntry {
  return { id: uid("log"), at: nowText(), kind, action, detail };
}

function releaseFromCabinet(
  specimen: Specimen,
  cabinetName: string,
  reason: string,
  at: string
): Specimen {
  const placements = specimen.placements.map((p) =>
    p.cabinetId === specimen.cabinetId && p.releasedAt === null
      ? { ...p, releasedAt: at, reason }
      : p
  );
  return { ...specimen, cabinetId: null, placements };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "REVIEW_BATCH": {
      const batch = state.batches.find((b) => b.id === action.batchId);
      if (!batch) return state;
      const { ok, bad } = reviewBatch(batch, state.specimens);
      const at = nowText();

      if (!ok) {
        // 整批退回复核：标本与柜位不变，只记录
        const causeText = bad
          .map((sp) => {
            const causes = [];
            if (!sp.pressed) causes.push("未压制");
            if (sp.idStatus === "doubt") causes.push("鉴定存疑");
            return `${sp.collectionNo}（${causes.join("、")}）`;
          })
          .join("；");
        return {
          ...state,
          batches: state.batches.map((b) =>
            b.id === batch.id ? { ...b, reviewed: false } : b
          ),
          logs: [
            makeLog(
              "warn",
              `整批退回 · ${batch.name}`,
              `退回原因：${causeText}。标本与柜位保持不变，补全后重新复核。操作人：${action.operator}`
            ),
            ...state.logs,
          ],
          lastSyncedAt: at,
        };
      }

      return {
        ...state,
        batches: state.batches.map((b) =>
          b.id === batch.id ? { ...b, reviewed: true } : b
        ),
        logs: [
          makeLog(
            "success",
            `复核通过 · ${batch.name}`,
            `批内 ${batch.specimenIds.length} 份标本均已压制且鉴定确认，可安排除虫与封柜。操作人：${action.operator}`
          ),
          ...state.logs,
        ],
        lastSyncedAt: at,
      };
    }

    case "PEST_TREAT": {
      const batch = state.batches.find((b) => b.id === action.batchId);
      if (!batch) return state;
      const { ok, bad } = reviewBatch(batch, state.specimens);
      const at = nowText();
      if (!batch.reviewed || !ok) {
        return {
          ...state,
          logs: [
            makeLog(
              "error",
              `除虫被拒 · ${batch.name}`,
              "批次未通过复核（存在未压制或鉴定存疑标本），不得除虫。",
            ),
            ...state.logs,
          ],
          lastSyncedAt: at,
        };
      }
      const members = new Set(batch.specimenIds);
      let treated = 0;
      const specimens = state.specimens.map((s) => {
        // 已在柜、已除虫过的标本不重复登记（除虫记录持久保留）
        if (
          !members.has(s.id) ||
          s.cabinetId !== null ||
          s.pestRecords.length > 0
        ) {
          return s;
        }
        treated += 1;
        return {
          ...s,
          pestRecords: [
            { id: uid("pest"), at, method: action.method, operator: action.operator },
            ...s.pestRecords,
          ],
        };
      });
      return {
        ...state,
        specimens,
        logs: [
          makeLog(
            "success",
            `整批除虫 · ${batch.name}`,
            treated > 0
              ? `${treated} 份标本完成除虫（${action.method}），除虫记录已留存。操作人：${action.operator}`
              : `批内可处理标本此前均已除虫，记录保持不变（${action.method}）。操作人：${action.operator}`,
          ),
          ...state.logs,
        ],
        lastSyncedAt: at,
      };
    }

    case "SEAL_BATCH": {
      const batch = state.batches.find((b) => b.id === action.batchId);
      if (!batch) return state;
      const check = checkSeal(batch, action.cabinetId, state);
      const cabinet = state.cabinets.find((c) => c.id === action.cabinetId);
      const at = nowText();

      if (!check.ok) {
        // 整柜拒绝：不写入任何占用
        return {
          ...state,
          logs: [
            makeLog(
              "error",
              `封柜拒绝 · ${batch.name} → ${cabinet?.name ?? "未知柜位"}`,
              check.reasons.map((r) => r.message).join("；"),
            ),
            ...state.logs,
          ],
          lastSyncedAt: at,
        };
      }

      const candidates = new Set(check.candidates.map((s) => s.id));
      const specimens = state.specimens.map((s) => {
        if (!candidates.has(s.id)) return s;
        return {
          ...s,
          cabinetId: cabinet!.id,
          placements: [
            {
              id: uid("pl"),
              cabinetId: cabinet!.id,
              cabinetName: cabinet!.name,
              sealedAt: at,
              releasedAt: null,
              reason: null,
            },
            ...s.placements,
          ],
        };
      });

      return {
        ...state,
        specimens,
        logs: [
          makeLog(
            "success",
            `封柜完成 · ${batch.name} → ${cabinet!.name}`,
            `${check.candidates.length} 份标本封入 ${cabinet!.name}（${cabinet!.tier} 档，容量 ${
              cabinet!.capacity
            }）；重复占用、档位不符、容量不足任一出现都会整柜拒绝。操作人：${action.operator}`,
          ),
          ...state.logs,
        ],
        lastSyncedAt: at,
      };
    }

    case "RELEASE_SPECIMEN": {
      const specimen = state.specimens.find((s) => s.id === action.specimenId);
      if (!specimen || !specimen.cabinetId) return state;
      const cabinet = state.cabinets.find((c) => c.id === specimen.cabinetId);
      const at = nowText();
      const specimens = state.specimens.map((s) =>
        s.id === specimen.id
          ? releaseFromCabinet(
              s,
              cabinet?.name ?? "未知柜位",
              action.reason,
              at
            )
          : s
      );
      // 释放后该标本所在批次需重新复核
      const batch = state.batches.find((b) =>
        b.specimenIds.includes(specimen.id)
      );
      const batches = state.batches.map((b) =>
        b.id === batch?.id ? { ...b, reviewed: false } : b
      );
      return {
        ...state,
        specimens,
        batches,
        logs: [
          makeLog(
            "warn",
            `释放柜位 · ${specimen.collectionNo}`,
            `已从 ${cabinet?.name ?? "柜位"} 移出（${action.reason}）；除虫记录 ${specimen.pestRecords.length} 条保留，补全并重新复核后方可再封柜。操作人：${action.operator}`,
          ),
          ...state.logs,
        ],
        lastSyncedAt: at,
      };
    }

    case "UPDATE_SPECIMEN": {
      const specimen = state.specimens.find((s) => s.id === action.specimenId);
      if (!specimen) return state;
      const at = nowText();
      const next: Specimen = { ...specimen, ...action.patch };
      const changedFields: string[] = [];
      const fieldName: Record<string, string> = {
        collectionNo: "采集号",
        species: "物种",
        location: "地点",
        altitude: "海拔",
        habitat: "生境",
        tier: "温湿度档",
        pressed: "压制状态",
        idStatus: "鉴定状态",
      };
      for (const key of Object.keys(action.patch)) {
        changedFields.push(fieldName[key] ?? key);
      }

      // 已封柜标本被改回“鉴定存疑/未压制”或档位变更 → 先释放柜位（保留除虫记录），批次复核失效
      const nowInvalid = !next.pressed || next.idStatus === "doubt";
      const tierChanged = action.patch.tier && action.patch.tier !== specimen.tier;
      const mustRelease = specimen.cabinetId !== null && (nowInvalid || tierChanged);

      let specimens = state.specimens;
      let batches = state.batches;
      const logs: LogEntry[] = [];

      if (mustRelease) {
        const cabinet = state.cabinets.find((c) => c.id === specimen.cabinetId);
        const reason = tierChanged
          ? `温湿度档由 ${specimen.tier} 档调整为 ${next.tier} 档`
          : next.idStatus === "doubt"
          ? "鉴定状态改回存疑"
          : "压制状态改回未压制";
        specimens = state.specimens.map((s) =>
          s.id === specimen.id
            ? releaseFromCabinet({ ...s, ...next }, cabinet?.name ?? "未知柜位", reason, at)
            : s
        );
        const batch = state.batches.find((b) =>
          b.specimenIds.includes(specimen.id)
        );
        batches = state.batches.map((b) =>
          b.id === batch?.id ? { ...b, reviewed: false } : b
        );
        logs.push(
          makeLog(
            "warn",
            `先释放柜位 · ${next.collectionNo}`,
            `${specimen.collectionNo} 已封柜，因「${reason}」先移出 ${
              cabinet?.name ?? "柜位"
            }；除虫记录 ${specimen.pestRecords.length} 条保留，补全并重新复核后才能重新封柜。操作人：${
              action.operator
            }`
          )
        );
      } else if (nowInvalid) {
        // 未封柜但变不合格：批次复核失效，等待整批复核
        const batch = state.batches.find((b) =>
          b.specimenIds.includes(specimen.id)
        );
        if (batch?.reviewed) {
          batches = state.batches.map((b) =>
            b.id === batch.id ? { ...b, reviewed: false } : b
          );
        }
        specimens = state.specimens.map((s) =>
          s.id === specimen.id ? next : s
        );
      } else {
        specimens = state.specimens.map((s) =>
          s.id === specimen.id ? next : s
        );
      }

      logs.push(
        makeLog(
          "info",
          `更新标本 · ${specimen.collectionNo}`,
          `修改字段：${changedFields.join("、")}。操作人：${action.operator}`
        )
      );

      return {
        ...state,
        specimens,
        batches,
        logs: [...logs, ...state.logs],
        lastSyncedAt: at,
      };
    }

    case "RESET":
      return buildPresetState();

    default:
      return state;
  }
}

// 导出供单元走查使用
export { reducer };

// —— Context ——
interface Store {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储不可用时静默，界面仍可操作
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
