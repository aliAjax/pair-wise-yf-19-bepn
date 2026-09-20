import { useMemo, useState } from "react";
import { useStore } from "../store";
import { TIER_SHORT } from "../types";
import type { Specimen } from "../types";

export type QuickFilter =
  | "all"
  | "pressed"
  | "unpressed"
  | "confirmed"
  | "doubt"
  | "untreated"
  | "sealed";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "unpressed", label: "未压制" },
  { key: "pressed", label: "已压制" },
  { key: "doubt", label: "鉴定存疑" },
  { key: "confirmed", label: "鉴定确认" },
  { key: "untreated", label: "未除虫" },
  { key: "sealed", label: "已封柜" },
];

interface Props {
  operator: string;
  onInspect: (s: Specimen) => void;
}

export default function SpecimenTable({ operator, onInspect }: Props) {
  const { state, dispatch } = useStore();
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [tier, setTier] = useState("");
  const [batchId, setBatchId] = useState("");
  const [keyword, setKeyword] = useState("");

  const counts = useMemo(() => {
    const c: Record<QuickFilter, number> = {
      all: state.specimens.length,
      pressed: 0,
      unpressed: 0,
      confirmed: 0,
      doubt: 0,
      untreated: 0,
      sealed: 0,
    };
    for (const s of state.specimens) {
      if (s.pressed) c.pressed += 1;
      else c.unpressed += 1;
      if (s.idStatus === "doubt") c.doubt += 1;
      else c.confirmed += 1;
      if (s.pestRecords.length === 0) c.untreated += 1;
      if (s.cabinetId) c.sealed += 1;
    }
    return c;
  }, [state.specimens]);

  const list = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return state.specimens.filter((s) => {
      switch (quick) {
        case "pressed":
          if (!s.pressed) return false;
          break;
        case "unpressed":
          if (s.pressed) return false;
          break;
        case "confirmed":
          if (s.idStatus !== "confirmed") return false;
          break;
        case "doubt":
          if (s.idStatus !== "doubt") return false;
          break;
        case "untreated":
          if (s.pestRecords.length > 0) return false;
          break;
        case "sealed":
          if (!s.cabinetId) return false;
          break;
      }
      if (tier && s.tier !== tier) return false;
      if (batchId) {
        const b = state.batches.find((x) => x.id === batchId);
        if (!b || !b.specimenIds.includes(s.id)) return false;
      }
      if (kw) {
        const hay = [
          s.collectionNo,
          s.species,
          s.location,
          s.altitude,
          s.habitat,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [state.specimens, state.batches, quick, tier, batchId, keyword]);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>采集号 · 物种 · 地点 · 海拔 · 生境 · 压制 / 鉴定筛选</p>
          <h2>标本台账</h2>
        </div>
        <input
          className="search-box"
          placeholder="检索 采集号 / 物种 / 地点 / 海拔 / 生境"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="filter-row">
        <div className="chips">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              className={quick === f.key ? "chip active" : "chip"}
              onClick={() => setQuick(f.key)}
            >
              {f.label}
              <em>{counts[f.key]}</em>
            </button>
          ))}
        </div>
        <div className="filter-selects">
          <select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">全部温湿度档</option>
            <option value="A">A 档 · 低温干燥</option>
            <option value="B">B 档 · 恒温恒湿</option>
            <option value="C">C 档 · 常温干燥</option>
          </select>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">全部批次</option>
            {state.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="spec-table">
          <thead>
            <tr>
              <th>采集号 / 物种</th>
              <th>地点 · 海拔 · 生境</th>
              <th>档位</th>
              <th>压制</th>
              <th>鉴定</th>
              <th>除虫</th>
              <th>柜位</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const cab = state.cabinets.find((c) => c.id === s.cabinetId);
              const batch = state.batches.find((b) =>
                b.specimenIds.includes(s.id)
              );
              return (
                <tr key={s.id} className={s.cabinetId ? "row-sealed" : ""}>
                  <td>
                    <button className="cell-main" onClick={() => onInspect(s)}>
                      <b>{s.collectionNo}</b>
                      <span>{s.species}</span>
                    </button>
                    <small className="muted">{batch?.name}</small>
                  </td>
                  <td className="loc-cell">
                    <span>{s.location}</span>
                    <small className="muted">
                      {s.altitude} · {s.habitat}
                    </small>
                  </td>
                  <td>
                    <span className={`tier-tag tier-${s.tier}`}>
                      {TIER_SHORT[s.tier]}
                    </span>
                  </td>
                  <td>
                    <Toggle
                      on={s.pressed}
                      onLabel="已压制"
                      offLabel="未压制"
                      onToggle={() =>
                        dispatch({
                          type: "UPDATE_SPECIMEN",
                          specimenId: s.id,
                          patch: { pressed: !s.pressed },
                          operator,
                        })
                      }
                    />
                  </td>
                  <td>
                    <Toggle
                      on={s.idStatus === "confirmed"}
                      onLabel="已确认"
                      offLabel="存疑"
                      dangerOff
                      onToggle={() =>
                        dispatch({
                          type: "UPDATE_SPECIMEN",
                          specimenId: s.id,
                          patch: {
                            idStatus:
                              s.idStatus === "confirmed" ? "doubt" : "confirmed",
                          },
                          operator,
                        })
                      }
                    />
                  </td>
                  <td>
                    <span
                      className={`mini-badge ${
                        s.pestRecords.length > 0 ? "treated" : ""
                      }`}
                    >
                      {s.pestRecords.length > 0
                        ? `${s.pestRecords.length} 条记录`
                        : "未除虫"}
                    </span>
                  </td>
                  <td>
                    {cab ? (
                      <span className="mini-badge ok">{cab.name}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => onInspect(s)}>详情/编辑</button>
                      {cab && (
                        <button
                          className="danger"
                          onClick={() =>
                            dispatch({
                              type: "RELEASE_SPECIMEN",
                              specimenId: s.id,
                              reason: "台账手动释放",
                              operator,
                            })
                          }
                        >
                          释放柜位
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="muted empty-row">
                  没有符合筛选条件的标本
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Toggle({
  on,
  onLabel,
  offLabel,
  dangerOff,
  onToggle,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  dangerOff?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`toggle ${on ? "on" : dangerOff ? "off-danger" : "off"}`}
      onClick={onToggle}
      title="点击切换（已封柜标本改为不合格将先释放柜位）"
    >
      <i />
      {on ? onLabel : offLabel}
    </button>
  );
}
