import { useStore } from "../store";
import { TIER_LABEL } from "../types";
import type { Specimen } from "../types";

interface Props {
  operator: string;
  onInspect: (s: Specimen) => void;
}

export default function CabinetPanel({ operator, onInspect }: Props) {
  const { state, dispatch } = useStore();

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>柜位记录与容量</p>
          <h2>除虫封柜 · 三个柜位</h2>
        </div>
        <span className="rule-note">
          规则：温湿度档一致 · 容量足够 · 不得重复占用，违反则整柜拒绝
        </span>
      </div>

      <div className="cabinet-grid">
        {state.cabinets.map((cab) => {
          const held = state.specimens.filter((s) => s.cabinetId === cab.id);
          const ratio = held.length / cab.capacity;
          return (
            <article key={cab.id} className={`cabinet-card tier-${cab.tier}`}>
              <header>
                <div>
                  <h3>{cab.name}</h3>
                  <p className="muted">{TIER_LABEL[cab.tier]}</p>
                </div>
                <span className={`cap-badge ${ratio >= 1 ? "full" : ""}`}>
                  {held.length}/{cab.capacity}
                </span>
              </header>
              <p className="muted cab-desc">{cab.desc}</p>
              <div className="cap-bar">
                <i
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                  className={ratio >= 1 ? "full" : ""}
                />
              </div>
              <ul className="held-list">
                {held.length === 0 && (
                  <li className="muted empty">柜内暂无标本</li>
                )}
                {held.map((s) => {
                  const cur = s.placements.find(
                    (p) => p.cabinetId === cab.id && p.releasedAt === null
                  );
                  return (
                    <li key={s.id}>
                      <button className="member-link" onClick={() => onInspect(s)}>
                        <b>{s.collectionNo}</b>
                        <span>{s.species}</span>
                      </button>
                      <div className="held-meta">
                        <span className="mini-badge ok">
                          封入 {cur?.sealedAt ?? "—"}
                        </span>
                        <button
                          className="link-danger"
                          onClick={() =>
                            dispatch({
                              type: "RELEASE_SPECIMEN",
                              specimenId: s.id,
                              reason: "柜位手动移出",
                              operator,
                            })
                          }
                        >
                          移出
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
