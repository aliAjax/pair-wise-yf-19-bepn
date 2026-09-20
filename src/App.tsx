import { useMemo, useState } from "react";
import { StoreProvider, useStore } from "./store";
import BatchPanel from "./components/BatchPanel";
import CabinetPanel from "./components/CabinetPanel";
import SpecimenTable from "./components/SpecimenTable";
import SpecimenModal from "./components/SpecimenModal";
import LogPanel from "./components/LogPanel";
import type { Specimen } from "./types";

function Workspace() {
  const { state, dispatch } = useStore();
  const [operator, setOperator] = useState("标本管理员");
  const [inspectId, setInspectId] = useState<string | null>(null);

  const inspect: Specimen | null =
    state.specimens.find((s) => s.id === inspectId) ?? null;

  const stats = useMemo(() => {
    const sealed = state.specimens.filter((s) => s.cabinetId).length;
    const doubt = state.specimens.filter((s) => s.idStatus === "doubt").length;
    const unpressed = state.specimens.filter((s) => !s.pressed).length;
    const untreated = state.specimens.filter(
      (s) => s.pestRecords.length === 0
    ).length;
    return {
      total: state.specimens.length,
      sealed,
      doubt,
      unpressed,
      untreated,
      batches: state.batches.length,
      cabinets: state.cabinets.length,
    };
  }, [state]);

  return (
    <main className="app">
      <section className="hero">
        <div className="hero-row">
          <p>植物标本馆 · 除虫封柜作业台</p>
          <div className="sync-box">
            <span className={`sync-dot ${state.lastSyncedAt ? "on" : ""}`} />
            {state.lastSyncedAt
              ? `本地数据已同步 ${state.lastSyncedAt}`
              : "预置数据已载入（操作后自动同步本地，刷新保留）"}
          </div>
        </div>
        <h1>整批复核 → 除虫 → 封柜</h1>
        <span className="hero-rules">
          ① 同批一份未压制或鉴定存疑，整批退回复核，标本与柜位不变；②
          每份标本只能进入容量足够且温湿度档一致的柜位，重复占用或档位不符整柜拒绝；③
          已封柜标本改回鉴定存疑时，先释放柜位并保留除虫记录，补全重审后才能重新封柜。
        </span>
        <div className="hero-tools">
          <label className="operator">
            操作人
            <input value={operator} onChange={(e) => setOperator(e.target.value)} />
          </label>
          <button
            className="ghost-danger"
            onClick={() => {
              if (
                window.confirm("确定恢复预置的 3 批标本与 3 个柜位？当前记录将清空。")
              ) {
                dispatch({ type: "RESET" });
              }
            }}
          >
            恢复预置数据
          </button>
        </div>
      </section>

      <section className="metrics">
        <article>
          <small>预置批次 / 标本</small>
          <strong>
            {stats.batches} 批 / {stats.total} 份
          </strong>
        </article>
        <article>
          <small>柜位（预置 {stats.cabinets}）</small>
          <strong>{stats.sealed} 份在柜</strong>
        </article>
        <article className={stats.doubt + stats.unpressed > 0 ? "metric-warn" : ""}>
          <small>鉴定存疑 / 未压制</small>
          <strong>
            {stats.doubt} / {stats.unpressed}
          </strong>
        </article>
        <article>
          <small>待除虫</small>
          <strong>{stats.untreated}</strong>
        </article>
      </section>

      <div className="layout-grid">
        <BatchPanel operator={operator} onInspect={(s) => setInspectId(s.id)} />
        <CabinetPanel operator={operator} onInspect={(s) => setInspectId(s.id)} />
      </div>

      <SpecimenTable operator={operator} onInspect={(s) => setInspectId(s.id)} />

      <LogPanel />

      <SpecimenModal
        specimen={inspect}
        operator={operator}
        onClose={() => setInspectId(null)}
      />

      <footer className="footnote muted">
        数据保存在浏览器 localStorage（键 herbarium-fume-cabinet:v1），刷新页面后全部记录与柜位占用保留。
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}
