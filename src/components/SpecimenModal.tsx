import { useEffect, useState } from "react";
import { useStore } from "../store";
import { TIER_LABEL, TIER_SHORT } from "../types";
import type { Specimen, Tier } from "../types";

interface Props {
  specimen: Specimen | null;
  operator: string;
  onClose: () => void;
}

export default function SpecimenModal({ specimen, operator, onClose }: Props) {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState<Specimen | null>(specimen);

  useEffect(() => {
    setForm(specimen);
  }, [specimen]);

  useEffect(() => {
    // 外部状态（如释放柜位）同步回表单的只读部分
    if (specimen) {
      setForm((cur) =>
        cur
          ? {
              ...cur,
              cabinetId: specimen.cabinetId,
              pestRecords: specimen.pestRecords,
              placements: specimen.placements,
            }
          : cur
      );
    }
  }, [specimen?.cabinetId, specimen?.pestRecords, specimen?.placements]);

  if (!specimen || !form) return null;
  const cab = state.cabinets.find((c) => c.id === specimen.cabinetId);
  const batch = state.batches.find((b) =>
    b.specimenIds.includes(specimen.id)
  );

  const set = <K extends keyof Specimen>(key: K, value: Specimen[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const dirty =
    form.collectionNo !== specimen.collectionNo ||
    form.species !== specimen.species ||
    form.location !== specimen.location ||
    form.altitude !== specimen.altitude ||
    form.habitat !== specimen.habitat ||
    form.tier !== specimen.tier ||
    form.pressed !== specimen.pressed ||
    form.idStatus !== specimen.idStatus;

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p>单份标本详情</p>
            <h2>{specimen.collectionNo}</h2>
            <span className="muted">{batch?.name}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            关闭 ✕
          </button>
        </header>

        <div className="modal-body">
          <div className="modal-section">
            <h3>采集与鉴定信息（可编辑）</h3>
            <div className="field-grid">
              <label>
                <span>采集号</span>
                <input
                  value={form.collectionNo}
                  onChange={(e) => set("collectionNo", e.target.value)}
                />
              </label>
              <label>
                <span>物种</span>
                <input
                  value={form.species}
                  onChange={(e) => set("species", e.target.value)}
                />
              </label>
              <label className="span-2">
                <span>采集地点</span>
                <input
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                />
              </label>
              <label>
                <span>海拔</span>
                <input
                  value={form.altitude}
                  onChange={(e) => set("altitude", e.target.value)}
                />
              </label>
              <label>
                <span>温湿度需求档</span>
                <select
                  value={form.tier}
                  onChange={(e) => set("tier", e.target.value as Tier)}
                >
                  {(["A", "B", "C"] as Tier[]).map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                <span>生境</span>
                <input
                  value={form.habitat}
                  onChange={(e) => set("habitat", e.target.value)}
                />
              </label>
              <label>
                <span>压制状态</span>
                <select
                  value={form.pressed ? "1" : "0"}
                  onChange={(e) => set("pressed", e.target.value === "1")}
                >
                  <option value="1">已压制</option>
                  <option value="0">未压制</option>
                </select>
              </label>
              <label>
                <span>鉴定状态</span>
                <select
                  value={form.idStatus}
                  onChange={(e) =>
                    set("idStatus", e.target.value as Specimen["idStatus"])
                  }
                >
                  <option value="confirmed">鉴定确认</option>
                  <option value="doubt">鉴定存疑</option>
                </select>
              </label>
            </div>

            {specimen.cabinetId &&
              (!form.pressed || form.idStatus === "doubt" || form.tier !== specimen.tier) && (
                <p className="form-warn">
                  ⚠ 该标本已封柜；保存后将先释放 {cab?.name}
                  （保留除虫记录），所在批次复核失效，补全并重审后才能重新封柜。
                </p>
              )}

            <div className="modal-actions">
              <button
                className="primary"
                disabled={!dirty || !form.collectionNo.trim() || !form.species.trim()}
                onClick={() => {
                  dispatch({
                    type: "UPDATE_SPECIMEN",
                    specimenId: specimen.id,
                    patch: {
                      collectionNo: form.collectionNo.trim(),
                      species: form.species.trim(),
                      location: form.location,
                      altitude: form.altitude,
                      habitat: form.habitat,
                      tier: form.tier,
                      pressed: form.pressed,
                      idStatus: form.idStatus,
                    },
                    operator,
                  });
                }}
              >
                保存修改
              </button>
              <button onClick={() => setForm(specimen)} disabled={!dirty}>
                还原
              </button>
            </div>
          </div>

          <div className="modal-section">
            <h3>除虫记录（释放柜位后仍保留 · {specimen.pestRecords.length} 条）</h3>
            {specimen.pestRecords.length === 0 ? (
              <p className="muted">暂无除虫记录；除虫随整批作业执行。</p>
            ) : (
              <ul className="record-list">
                {specimen.pestRecords.map((r) => (
                  <li key={r.id}>
                    <span className="rec-tag treated">{r.method}</span>
                    <div>
                      <b>{r.at}</b>
                      <small className="muted">操作人：{r.operator}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="modal-section">
            <h3>柜位记录（完整进出历史 · {specimen.placements.length} 条）</h3>
            {specimen.placements.length === 0 ? (
              <p className="muted">从未入柜。</p>
            ) : (
              <ul className="record-list">
                {specimen.placements.map((p) => (
                  <li key={p.id}>
                    <span className={`rec-tag ${p.releasedAt ? "released" : "ok"}`}>
                      {p.releasedAt ? "已移出" : "在柜"}
                    </span>
                    <div>
                      <b>
                        {p.cabinetName} · 封入 {p.sealedAt}
                      </b>
                      <small className="muted">
                        {p.releasedAt
                          ? `移出 ${p.releasedAt} · 原因：${p.reason}`
                          : `${TIER_SHORT[specimen.tier]} · 当前占用中`}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
