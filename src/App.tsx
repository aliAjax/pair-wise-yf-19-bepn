import { useEffect, useMemo, useState } from "react";
import "./styles.css";

/* ================= 类型 ================= */

type IdStatus = "已鉴定" | "存疑";
type FilterId = "all" | "unpressed" | "doubt" | "ready" | "sealed";

interface Specimen {
  id: string;
  batchId: string;
  collectionNo: string; // 采集号
  species: string; // 物种名称
  location: string; // 采集地点
  altitude: number; // 海拔(m)
  habitat: string; // 生境描述
  collector: string; // 采集人
  pressed: boolean; // 压制状态
  idStatus: IdStatus; // 鉴定状态
  requiredLevel: string; // 所需温湿度档
  cabinetId: string | null; // 已封入柜位
  sealedAt: string | null; // 封柜时间
}

interface PestRecord {
  id: string;
  specimenId: string;
  text: string;
  time: string;
}

interface Notice {
  id: string;
  kind: "ok" | "err" | "info";
  text: string;
}

interface Store {
  specimens: Specimen[];
  pestRecords: PestRecord[];
}

/* ================= 预置数据 ================= */

const LEVELS = [
  { id: "L1", label: "Ⅰ档", desc: "16℃ · 40%RH" },
  { id: "L2", label: "Ⅱ档", desc: "18℃ · 45%RH" },
  { id: "L3", label: "Ⅲ档", desc: "20℃ · 50%RH" },
];

const CABINETS = [
  { id: "CAB-A", name: "除虫柜 A", capacity: 3, levelId: "L1" },
  { id: "CAB-B", name: "除虫柜 B", capacity: 3, levelId: "L2" },
  { id: "CAB-C", name: "除虫柜 C", capacity: 4, levelId: "L3" },
];

const BATCHES = [
  { id: "B1", name: "第一批 · 滇西北横断山", note: "2026-09-12 入馆" },
  { id: "B2", name: "第二批 · 滇南季雨林", note: "2026-09-15 入馆" },
  { id: "B3", name: "第三批 · 滇中高原湖泊", note: "2026-09-18 入馆" },
];

function seedSpecimens(): Specimen[] {
  return [
    { id: "S01", batchId: "B1", collectionNo: "HX-260912-01", species: "云南黄连 Coptis teeta", location: "贡山·独龙江乡", altitude: 1420, habitat: "阴湿沟谷常绿阔叶林下", collector: "李蔚然", pressed: true, idStatus: "已鉴定", requiredLevel: "L1", cabinetId: null, sealedAt: null },
    { id: "S02", batchId: "B1", collectionNo: "HX-260912-02", species: "槭属待定 Acer sp.", location: "贡山·普拉底乡", altitude: 1860, habitat: "针阔混交林缘", collector: "李蔚然", pressed: false, idStatus: "存疑", requiredLevel: "L1", cabinetId: null, sealedAt: null },
    { id: "S03", batchId: "B1", collectionNo: "HX-260912-03", species: "狭叶凤尾蕨 Pteris henryi", location: "福贡·石月亮", altitude: 2100, habitat: "石灰岩缝阴湿处", collector: "王青禾", pressed: true, idStatus: "已鉴定", requiredLevel: "L2", cabinetId: null, sealedAt: null },
    { id: "S04", batchId: "B2", collectionNo: "HX-260915-01", species: "云南石斛 Dendrobium yunnanense", location: "勐腊·望天树景区", altitude: 780, habitat: "季雨林树干附生", collector: "陈雨桐", pressed: true, idStatus: "已鉴定", requiredLevel: "L2", cabinetId: null, sealedAt: null },
    { id: "S05", batchId: "B2", collectionNo: "HX-260915-02", species: "滇南狗脊 Woodwardia sp.", location: "勐仑·葫芦岛", altitude: 650, habitat: "沟谷雨林溪边", collector: "陈雨桐", pressed: true, idStatus: "已鉴定", requiredLevel: "L3", cabinetId: null, sealedAt: null },
    { id: "S06", batchId: "B2", collectionNo: "HX-260915-03", species: "老虎须 Tacca chantrieri", location: "勐远·仙境沟谷", altitude: 720, habitat: "雨林下层阴湿处", collector: "赵关山", pressed: true, idStatus: "已鉴定", requiredLevel: "L3", cabinetId: null, sealedAt: null },
    { id: "S07", batchId: "B3", collectionNo: "HX-260918-01", species: "海菜花 Ottelia acuminata", location: "大理·洱海源", altitude: 1970, habitat: "湖泊浅水区", collector: "赵关山", pressed: true, idStatus: "已鉴定", requiredLevel: "L1", cabinetId: null, sealedAt: null },
    { id: "S08", batchId: "B3", collectionNo: "HX-260918-02", species: "茈碧莲 Nymphaea tetragona", location: "洱源·茈碧湖", altitude: 2050, habitat: "湖湾静水区", collector: "周牧云", pressed: true, idStatus: "存疑", requiredLevel: "L2", cabinetId: null, sealedAt: null },
    { id: "S09", batchId: "B3", collectionNo: "HX-260918-03", species: "灯芯草 Juncus effusus", location: "剑川·剑湖", altitude: 2180, habitat: "湖岸沼泽", collector: "周牧云", pressed: true, idStatus: "已鉴定", requiredLevel: "L1", cabinetId: null, sealedAt: null },
  ];
}

const STORE_KEY = "hxyfront-62007-herbarium-v1";

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (Array.isArray(parsed.specimens) && Array.isArray(parsed.pestRecords)) {
        return parsed;
      }
    }
  } catch {
    /* 本地数据损坏时回退到预置数据 */
  }
  return { specimens: seedSpecimens(), pestRecords: [] };
}

/* ================= 工具 ================= */

const rid = () => Math.random().toString(36).slice(2, 10);
const nowStr = () => new Date().toLocaleString("zh-CN", { hour12: false });
const levelOf = (id: string) => LEVELS.find((l) => l.id === id)!;
const cabOf = (id: string) => CABINETS.find((c) => c.id === id)!;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "unpressed", label: "待压制" },
  { id: "doubt", label: "鉴定存疑" },
  { id: "ready", label: "可封柜" },
  { id: "sealed", label: "已封柜" },
];

/* ================= 应用 ================= */

function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<Notice[]>([]);
  const [savedAt, setSavedAt] = useState("");

  const { specimens, pestRecords } = store;

  /* 本地数据同步：任何变更立即写入 localStorage，刷新后保留 */
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    setSavedAt(nowStr());
  }, [store]);

  const pushNotice = (kind: Notice["kind"], text: string) =>
    setNotices((prev) => [{ id: rid(), kind, text }, ...prev].slice(0, 8));

  /* ---------- 派生数据 ---------- */

  const batchInfo = (batchId: string) => {
    const list = specimens.filter((s) => s.batchId === batchId);
    const problems = list.filter((s) => !s.pressed || s.idStatus === "存疑");
    const ready = list.filter(
      (s) => !s.cabinetId && s.pressed && s.idStatus === "已鉴定"
    );
    const sealed = list.filter((s) => s.cabinetId);
    return { list, problems, ready, sealed, passed: problems.length === 0 };
  };

  const occupiedOf = (cabId: string) =>
    specimens.filter((s) => s.cabinetId === cabId).length;

  const defaultCabinetFor = (s: Specimen) => {
    const matched = CABINETS.filter((c) => c.levelId === s.requiredLevel);
    const withRoom = matched.find((c) => occupiedOf(c.id) < c.capacity);
    return (withRoom ?? matched[0])?.id ?? "";
  };

  const matches = (s: Specimen) => {
    switch (filter) {
      case "unpressed":
        return !s.pressed;
      case "doubt":
        return s.idStatus === "存疑";
      case "ready":
        return !s.cabinetId && s.pressed && s.idStatus === "已鉴定";
      case "sealed":
        return !!s.cabinetId;
      default:
        return true;
    }
  };

  const locations = useMemo(() => {
    const map = new Map<string, Specimen[]>();
    specimens.forEach((s) => {
      const key = s.location.split("·")[0];
      map.set(key, [...(map.get(key) ?? []), s]);
    });
    return [...map.entries()].map(([name, list]) => ({
      name,
      count: list.length,
      sealed: list.filter((s) => s.cabinetId).length,
      minAlt: Math.min(...list.map((s) => s.altitude)),
      maxAlt: Math.max(...list.map((s) => s.altitude)),
    }));
  }, [specimens]);

  const selected = specimens.find((s) => s.id === selectedId) ?? null;

  const metrics = {
    batches: BATCHES.length,
    pending: specimens.filter((s) => !s.pressed || s.idStatus === "存疑").length,
    sealed: specimens.filter((s) => s.cabinetId).length,
    occupied: CABINETS.reduce((n, c) => n + occupiedOf(c.id), 0),
    capacity: CABINETS.reduce((n, c) => n + c.capacity, 0),
  };

  /* ---------- 操作 ---------- */

  function togglePressed(spec: Specimen) {
    if (spec.cabinetId) return; // 已封柜标本须先改回存疑释放柜位
    setStore((prev) => ({
      ...prev,
      specimens: prev.specimens.map((s) =>
        s.id === spec.id ? { ...s, pressed: !s.pressed } : s
      ),
    }));
  }

  function changeIdStatus(spec: Specimen, next: IdStatus) {
    if (next === spec.idStatus) return;
    if (next === "存疑" && spec.cabinetId) {
      // 已封柜标本改回存疑：先释放柜位，除虫记录保留
      const cab = cabOf(spec.cabinetId);
      const time = nowStr();
      setStore((prev) => ({
        specimens: prev.specimens.map((s) =>
          s.id === spec.id
            ? { ...s, idStatus: "存疑", cabinetId: null, sealedAt: null }
            : s
        ),
        pestRecords: [
          ...prev.pestRecords,
          {
            id: rid(),
            specimenId: spec.id,
            text: `鉴定改回存疑，释放 ${cab.name} 柜位；除虫记录保留，补全后可重新封柜`,
            time,
          },
        ],
      }));
      pushNotice("info", `${spec.collectionNo} 已释放 ${cab.name} 柜位，除虫记录保留`);
    } else {
      setStore((prev) => ({
        ...prev,
        specimens: prev.specimens.map((s) =>
          s.id === spec.id ? { ...s, idStatus: next } : s
        ),
      }));
    }
  }

  function sealBatch(batchId: string) {
    const batch = BATCHES.find((b) => b.id === batchId)!;
    const info = batchInfo(batchId);

    // 同批有一份未压制或鉴定存疑 → 整批退回复核，标本和柜位不变
    if (!info.passed) {
      pushNotice(
        "err",
        `【整批退回】${batch.name} 存在未压制或鉴定存疑标本（${info.problems
          .map((p) => p.collectionNo)
          .join("、")}），整批退回复核，标本与柜位不变`
      );
      return;
    }
    if (!info.ready.length) {
      pushNotice("info", `${batch.name} 没有待封柜标本`);
      return;
    }

    // 按目标柜分组，逐柜校验：容量足够 + 档位一致，否则整柜拒绝
    const byCab = new Map<string, Specimen[]>();
    info.ready.forEach((s) => {
      const cabId = selections[s.id] || defaultCabinetFor(s);
      if (!cabId) return;
      byCab.set(cabId, [...(byCab.get(cabId) ?? []), s]);
    });

    const accepted = new Map<string, string>(); // specimenId -> cabinetId
    const newRecords: PestRecord[] = [];
    const time = nowStr();

    byCab.forEach((items, cabId) => {
      const cab = cabOf(cabId);
      const dup = items.filter((i) =>
        specimens.some((x) => x.cabinetId === cabId && x.id === i.id)
      );
      if (dup.length) {
        pushNotice(
          "err",
          `【整柜拒绝】${cab.name}：${dup
            .map((d) => d.collectionNo)
            .join("、")} 重复占用柜位`
        );
        return;
      }
      const mismatch = items.filter((i) => i.requiredLevel !== cab.levelId);
      if (mismatch.length) {
        pushNotice(
          "err",
          `【整柜拒绝】${cab.name}：${mismatch
            .map((m) => `${m.collectionNo}（需${levelOf(m.requiredLevel).label}）`)
            .join("、")} 与柜位档位（${levelOf(cab.levelId).label}）不符`
        );
        return;
      }
      const occupied = occupiedOf(cabId);
      if (occupied + items.length > cab.capacity) {
        pushNotice(
          "err",
          `【整柜拒绝】${cab.name}：容量不足（已占 ${occupied}/${cab.capacity}，本次申请 ${items.length} 份）`
        );
        return;
      }
      items.forEach((i) => {
        accepted.set(i.id, cabId);
        newRecords.push({
          id: rid(),
          specimenId: i.id,
          text: `除虫熏蒸完成，封入 ${cab.name}（${levelOf(cab.levelId).label} · ${
            levelOf(cab.levelId).desc
          }）`,
          time,
        });
      });
      pushNotice(
        "ok",
        `【封柜成功】${cab.name} 接收 ${items.length} 份：${items
          .map((i) => i.collectionNo)
          .join("、")}`
      );
    });

    if (accepted.size) {
      setStore((prev) => ({
        specimens: prev.specimens.map((s) =>
          accepted.has(s.id)
            ? { ...s, cabinetId: accepted.get(s.id)!, sealedAt: time }
            : s
        ),
        pestRecords: [...prev.pestRecords, ...newRecords],
      }));
      setSelections((prev) => {
        const next = { ...prev };
        accepted.forEach((_, id) => delete next[id]);
        return next;
      });
    }
  }

  function resetAll() {
    setStore({ specimens: seedSpecimens(), pestRecords: [] });
    setSelections({});
    setSelectedId(null);
    setNotices([]);
    pushNotice("info", "已重置为预置数据（三批标本 · 三个除虫柜）");
  }

  /* ================= 渲染 ================= */

  return (
    <main className="app">
      <section className="hero">
        <div className="hero-top">
          <p>hxyfront-62007 · 源提示词9 · Port 62007</p>
          <div className="sync">
            <span className="sync-dot" />
            本地数据已同步{savedAt ? ` · ${savedAt}` : ""} · 刷新保留
            <button className="mini-btn" onClick={resetAll}>
              重置预置数据
            </button>
          </div>
        </div>
        <h1>植物标本馆除虫封柜台</h1>
        <span>
          预置三批标本与三个除虫柜。同批有一份未压制或鉴定存疑即整批退回复核；复核完成后，每份标本只能进入容量足够且温湿度档一致的柜位，重复占用或档位不符将整柜拒绝；已封柜标本改回鉴定存疑时先释放柜位并保留除虫记录，补全后才能重新封柜。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>入库批次</small>
          <strong>{metrics.batches}</strong>
        </article>
        <article>
          <small>待复核（份）</small>
          <strong>{metrics.pending}</strong>
        </article>
        <article>
          <small>已封柜（份）</small>
          <strong>{metrics.sealed}</strong>
        </article>
        <article>
          <small>柜位占用</small>
          <strong>
            {metrics.occupied}/{metrics.capacity}
          </strong>
        </article>
      </section>

      <section className="loc-cards">
        {locations.map((loc) => (
          <article key={loc.name} className="loc-card">
            <b>{loc.name}</b>
            <span>
              {loc.count} 份 · 海拔 {loc.minAlt}–{loc.maxAlt}m
            </span>
            <small>已封柜 {loc.sealed} 份</small>
          </article>
        ))}
      </section>

      <div className="layout">
        <div className="main-col">
          <section className="panel">
            <div className="heading">
              <div>
                <p>压制 / 鉴定筛选</p>
                <h2>入库队列</h2>
              </div>
            </div>
            <div className="chips">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={filter === f.id ? "chip-active" : ""}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          {notices.length > 0 && (
            <div className="notices">
              {notices.map((n) => (
                <div key={n.id} className={`notice ${n.kind}`}>
                  <span>{n.text}</span>
                  <button
                    className="notice-x"
                    onClick={() =>
                      setNotices((prev) => prev.filter((x) => x.id !== n.id))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {BATCHES.map((batch) => {
            const info = batchInfo(batch.id);
            const visible = info.list.filter(matches);
            const badge = !info.passed
              ? { cls: "badge-red", text: "整批退回复核" }
              : info.sealed.length === info.list.length
              ? { cls: "badge-green", text: "全部封柜完成" }
              : { cls: "badge-teal", text: "复核通过 · 待封柜" };
            return (
              <section className="panel batch" key={batch.id}>
                <div className="heading">
                  <div>
                    <p>{batch.note}</p>
                    <h2>{batch.name}</h2>
                  </div>
                  <span className={`badge ${badge.cls}`}>{badge.text}</span>
                </div>

                {!info.passed && (
                  <div className="return-note">
                    同批存在未压制或鉴定存疑标本（
                    {info.problems.map((p) => p.collectionNo).join("、")}
                    ），整批退回复核，标本与柜位保持不变。
                  </div>
                )}

                <div className="spec-rows">
                  {visible.length === 0 && (
                    <p className="empty">当前筛选条件下本批无标本。</p>
                  )}
                  {visible.map((s) => {
                    const ready =
                      !s.cabinetId && s.pressed && s.idStatus === "已鉴定";
                    return (
                      <article
                        key={s.id}
                        className={`spec-row${
                          selectedId === s.id ? " spec-selected" : ""
                        }`}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <div className="spec-main">
                          <h3>{s.collectionNo}</h3>
                          <p>
                            {s.species} · {s.location} · 海拔{s.altitude}m ·{" "}
                            {s.habitat}
                          </p>
                          <div className="badges">
                            <span
                              className={`badge ${
                                s.pressed ? "badge-green" : "badge-amber"
                              }`}
                            >
                              {s.pressed ? "已压制" : "未压制"}
                            </span>
                            <span
                              className={`badge ${
                                s.idStatus === "已鉴定"
                                  ? "badge-teal"
                                  : "badge-red"
                              }`}
                            >
                              {s.idStatus === "已鉴定" ? "已鉴定" : "鉴定存疑"}
                            </span>
                            <span className="badge badge-gray">
                              需{levelOf(s.requiredLevel).label} ·{" "}
                              {levelOf(s.requiredLevel).desc}
                            </span>
                            <span
                              className={`badge ${
                                s.cabinetId ? "badge-green" : "badge-gray"
                              }`}
                            >
                              {s.cabinetId ? cabOf(s.cabinetId).name : "未上柜"}
                            </span>
                          </div>
                        </div>
                        {ready && info.passed && (
                          <div
                            className="row-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              value={selections[s.id] ?? defaultCabinetFor(s)}
                              onChange={(e) =>
                                setSelections((prev) => ({
                                  ...prev,
                                  [s.id]: e.target.value,
                                }))
                              }
                            >
                              {CABINETS.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} · {levelOf(c.levelId).label} · 已占
                                  {occupiedOf(c.id)}/{c.capacity}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                {info.passed && info.ready.length > 0 && (
                  <div className="batch-footer">
                    <button
                      className="primary"
                      onClick={() => sealBatch(batch.id)}
                    >
                      执行封柜（{info.ready.length} 份 · 逐柜校验）
                    </button>
                  </div>
                )}
                {!info.passed && (
                  <div className="batch-footer">
                    <button onClick={() => sealBatch(batch.id)}>
                      尝试封柜（将整批退回）
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <aside className="side-col">
          <section className="panel">
            <div className="heading">
              <div>
                <p>馆藏柜位记录</p>
                <h2>除虫柜</h2>
              </div>
            </div>
            <div className="cab-list">
              {CABINETS.map((c) => {
                const occ = specimens.filter((s) => s.cabinetId === c.id);
                const lv = levelOf(c.levelId);
                return (
                  <article key={c.id} className="cab-card">
                    <div className="cab-head">
                      <b>{c.name}</b>
                      <span className="badge badge-gray">
                        {lv.label} · {lv.desc}
                      </span>
                    </div>
                    <div className="cab-bar">
                      <i
                        style={{
                          width: `${(occ.length / c.capacity) * 100}%`,
                        }}
                      />
                    </div>
                    <small>
                      占用 {occ.length}/{c.capacity}
                      {occ.length >= c.capacity ? " · 已满" : ""}
                    </small>
                    {occ.length > 0 && (
                      <ul>
                        {occ.map((s) => (
                          <li key={s.id}>
                            {s.collectionNo} · {s.sealedAt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="heading">
              <div>
                <p>单份标本详情</p>
                <h2>{selected ? selected.collectionNo : "未选择"}</h2>
              </div>
            </div>
            {!selected && <p className="empty">点击左侧标本行查看详情。</p>}
            {selected && (
              <>
                <div className="detail-grid">
                  <div className="kv">
                    <span>采集号</span>
                    <b>{selected.collectionNo}</b>
                  </div>
                  <div className="kv">
                    <span>物种名称</span>
                    <b>{selected.species}</b>
                  </div>
                  <div className="kv">
                    <span>采集地点</span>
                    <b>{selected.location}</b>
                  </div>
                  <div className="kv">
                    <span>海拔</span>
                    <b>{selected.altitude} m</b>
                  </div>
                  <div className="kv">
                    <span>生境描述</span>
                    <b>{selected.habitat}</b>
                  </div>
                  <div className="kv">
                    <span>采集人</span>
                    <b>{selected.collector}</b>
                  </div>
                  <div className="kv">
                    <span>压制状态</span>
                    <b>{selected.pressed ? "已压制" : "未压制"}</b>
                  </div>
                  <div className="kv">
                    <span>鉴定状态</span>
                    <b>{selected.idStatus}</b>
                  </div>
                  <div className="kv">
                    <span>所需档位</span>
                    <b>
                      {levelOf(selected.requiredLevel).label} ·{" "}
                      {levelOf(selected.requiredLevel).desc}
                    </b>
                  </div>
                  <div className="kv">
                    <span>馆藏位置</span>
                    <b>
                      {selected.cabinetId
                        ? `${cabOf(selected.cabinetId).name} · ${
                            selected.sealedAt
                          }`
                        : "未上柜"}
                    </b>
                  </div>
                </div>

                <div className="detail-actions">
                  <button
                    onClick={() => togglePressed(selected)}
                    disabled={!!selected.cabinetId}
                    title={
                      selected.cabinetId
                        ? "已封柜标本须先改回鉴定存疑释放柜位"
                        : undefined
                    }
                  >
                    {selected.pressed ? "标记为未压制" : "标记为已压制"}
                  </button>
                  {selected.idStatus === "已鉴定" ? (
                    <button onClick={() => changeIdStatus(selected, "存疑")}>
                      改回鉴定存疑
                    </button>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => changeIdStatus(selected, "已鉴定")}
                    >
                      确认鉴定
                    </button>
                  )}
                </div>
                {selected.cabinetId && (
                  <p className="hint">
                    已封柜标本改回鉴定存疑时，将先释放柜位并保留除虫记录，补全后才能重新封柜。
                  </p>
                )}

                <div className="pest">
                  <h3>除虫记录</h3>
                  {pestRecords.filter((r) => r.specimenId === selected.id)
                    .length === 0 && <p className="empty">暂无除虫记录。</p>}
                  <ul className="pest-list">
                    {pestRecords
                      .filter((r) => r.specimenId === selected.id)
                      .slice()
                      .reverse()
                      .map((r) => (
                        <li key={r.id}>
                          <span>{r.text}</span>
                          <small>{r.time}</small>
                        </li>
                      ))}
                  </ul>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

export default App;
