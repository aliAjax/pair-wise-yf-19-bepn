import { useMemo, useState } from "react";
import {
  checkSeal,
  reviewBatch,
  useStore,
} from "../store";
import type { Batch, Specimen } from "../types";
import { TIER_SHORT } from "../types";

const PEST_METHODS = ["冷冻除虫 −30℃ / 72h", "环氧乙烷熏蒸", "低氧充氮 30d", "微波快速灭虫"];

interface Props {
  operator: string;
  onInspect: (s: Specimen) => void;
}

export default function BatchPanel({ operator, onInspect }: Props) {
  const { state, dispatch } = useStore();

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>整批作业流水线</p>
          <h2>批次工作台</h2>
        </div>
        <span className="rule-note">
          规则：一批内有一份未压制或鉴定存疑 → 整批退回复核（标本、柜位不变）
        </span>
      </div>

      <div className="batch-list">
        {state.batches.map((batch) => (
          <BatchCard
            key={batch.id}
            batch={batch}
            operator={operator}
            onInspect={onInspect}
            onReview={() =>
              dispatch({ type: "REVIEW_BATCH", batchId: batch.id, operator })
            }
            onPest={(method) =>
              dispatch({ type: "PEST_TREAT", batchId: batch.id, method, operator })
            }
            onSeal={(cabinetId) =>
              dispatch({
                type: "SEAL_BATCH",
                batchId: batch.id,
                cabinetId,
                operator,
              })
            }
          />
        ))}
      </div>
    </section>
  );
}

function BatchCard({
  batch,
  operator,
  onReview,
  onPest,
  onSeal,
  onInspect,
}: {
  batch: Batch;
  operator: string;
  onReview: () => void;
  onPest: (method: string) => void;
  onSeal: (cabinetId: string) => void;
  onInspect: (s: Specimen) => void;
}) {
  const { state } = useStore();
  const [method, setMethod] = useState(PEST_METHODS[0]);
  const [cabinetId, setCabinetId] = useState("");
  const [preview, setPreview] = useState(false);

  const members = useMemo(
    () =>
      batch.specimenIds
        .map((id) => state.specimens.find((s) => s.id === id))
        .filter((s): s is Specimen => Boolean(s)),
    [batch, state.specimens]
  );
  const { ok, bad } = reviewBatch(batch, state.specimens);
  const treatedCount = members.filter((s) => s.pestRecords.length > 0).length;
  const sealedCount = members.filter((s) => s.cabinetId !== null).length;
  const allSealed = sealedCount === members.length && members.length > 0;
  const allTreated = treatedCount === members.length;

  const sealState = useMemo(() => {
    const target = cabinetId
      ? state.cabinets.find((c) => c.id === cabinetId)
      : pickDefaultCabinet(members, state.cabinets, state.specimens);
    if (!target) return null;
    return { cabinet: target, check: checkSeal(batch, target.id, state) };
  }, [batch, cabinetId, members, state.cabinets, state.specimens]);

  const selectedCabinetId = sealState?.cabinet.id ?? "";

  const phase: { text: string; cls: string; hint: string } = allSealed
    ? { text: "已封柜", cls: "ok", hint: "批内标本全部在柜" }
    : batch.reviewed && ok
    ? allTreated
      ? { text: "待封柜", cls: "info", hint: "复核与除虫均已完成，选择柜位封柜" }
      : { text: "待除虫", cls: "info", hint: "复核已通过，执行整批除虫" }
    : ok
    ? { text: "待复核", cls: "warn", hint: "整批齐备，等待复核" }
    : { text: "复核退回", cls: "err", hint: "含未压制/鉴定存疑，整批退回" };

  return (
    <article className={`batch-card tier-stripe-${members[0]?.tier ?? "A"}`}>
      <header className="batch-head">
        <div>
          <h3>{batch.name}</h3>
          <p className="muted">{batch.note}</p>
        </div>
        <span className={`phase-badge ${phase.cls}`}>{phase.text}</span>
      </header>

      <ul className="member-list">
        {members.map((s) => {
          const causes = [];
          if (!s.pressed) causes.push("未压制");
          if (s.idStatus === "doubt") causes.push("鉴定存疑");
          return (
            <li key={s.id}>
              <button className="member-link" onClick={() => onInspect(s)}>
                <b>{s.collectionNo}</b>
                <span>{s.species}</span>
              </button>
              <span className={`tier-tag tier-${s.tier}`}>{TIER_SHORT[s.tier]}</span>
              {causes.length > 0 ? (
                <span className="mini-badge err">{causes.join(" / ")}</span>
              ) : s.cabinetId ? (
                <span className="mini-badge ok">
                  在柜 ·{" "}
                  {state.cabinets.find((c) => c.id === s.cabinetId)?.name}
                </span>
              ) : s.pestRecords.length > 0 ? (
                <span className="mini-badge treated">已除虫 {s.pestRecords.length} 次</span>
              ) : (
                <span className="mini-badge">未除虫</span>
              )}
            </li>
          );
        })}
      </ul>

      {!ok && (
        <div className="batch-alert err">
          复核将整批退回：{bad
            .map((s) => s.collectionNo)
            .join("、")}{" "}
          未满足压制/鉴定要求；标本与柜位均不变化。
        </div>
      )}

      <div className="pipeline">
        {/* 第一步：复核 */}
        <div className={`pipe-step ${ok ? (batch.reviewed ? "done" : "") : "blocked"}`}>
          <small>① 整批复核</small>
          <button
            className="primary"
            disabled={allSealed}
            onClick={onReview}
            title={allSealed ? "已全部封柜" : undefined}
          >
            {batch.reviewed && ok ? "重新复核" : ok ? "通过复核" : "提交复核（将退回）"}
          </button>
          {batch.reviewed && ok && <span className="step-flag">已通过</span>}
        </div>

        {/* 第二步：除虫 */}
        <div className={`pipe-step ${allTreated ? "done" : ""}`}>
          <small>② 整批除虫</small>
          <select
            value={method}
            disabled={!batch.reviewed || !ok || allSealed}
            onChange={(e) => setMethod(e.target.value)}
          >
            {PEST_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            disabled={!batch.reviewed || !ok || allSealed}
            onClick={() => onPest(method)}
          >
            执行除虫
          </button>
          <span className="step-flag">
            {treatedCount}/{members.length} 已除虫
          </span>
        </div>

        {/* 第三步：封柜 */}
        <div className={`pipe-step ${allSealed ? "done" : ""}`}>
          <small>③ 整批封柜</small>
          <select
            value={selectedCabinetId}
            disabled={!allTreated || allSealed}
            onChange={(e) => {
              setCabinetId(e.target.value);
              setPreview(true);
            }}
          >
            <option value="">自动推荐柜位…</option>
            {state.cabinets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}（{c.tier} 档 / 容量 {c.capacity}）
              </option>
            ))}
          </select>
          <button
            className="primary"
            disabled={!allTreated || allSealed}
            onClick={() => sealState && onSeal(sealState.cabinet.id)}
          >
            整批封入
          </button>
          {sealState && !allSealed && (
            <span
              className={`step-flag ${sealState.check.ok ? "ok-text" : "err-text"}`}
            >
              {sealState.check.ok
                ? `预检通过 → ${sealState.cabinet.name}`
                : "预检不通过，整柜将拒绝"}
            </span>
          )}
          {allSealed && <span className="step-flag ok-text">全部在柜</span>}
        </div>
      </div>

      {sealState && !sealState.check.ok && !allSealed && (
        <div className="batch-alert err">
          {sealState.check.reasons.map((r, i) => (
            <div key={i}>✕ {r.message}</div>
          ))}
        </div>
      )}
      <p className="pipe-hint muted">{phase.hint} · 操作人 {operator}</p>
    </article>
  );
}

function pickDefaultCabinet(
  members: Specimen[],
  cabinets: ReturnType<typeof useStore>["state"]["cabinets"],
  specimens: Specimen[]
) {
  if (members.length === 0) return undefined;
  const tier = members[0].tier;
  return cabinets
    .filter((c) => c.tier === tier)
    .map((c) => ({
      c,
      free:
        c.capacity - specimens.filter((s) => s.cabinetId === c.id).length,
    }))
    .filter((x) => x.free > 0)
    .sort((a, b) => b.free - a.free)[0]?.c;
}
