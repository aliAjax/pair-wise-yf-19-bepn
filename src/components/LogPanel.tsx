import { useStore } from "../store";
import type { LogKind } from "../types";

const KIND_LABEL: Record<LogKind, string> = {
  success: "成功",
  error: "拒绝",
  warn: "退回/释放",
  info: "信息",
};

export default function LogPanel() {
  const { state } = useStore();

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>复核 · 除虫 · 封柜 · 释放 全程留痕</p>
          <h2>操作记录</h2>
        </div>
        <span className="muted">共 {state.logs.length} 条，最新在前</span>
      </div>
      <ul className="log-list">
        {state.logs.map((log) => (
          <li key={log.id} className={`log-item log-${log.kind}`}>
            <span className="log-kind">{KIND_LABEL[log.kind]}</span>
            <div>
              <b>
                {log.action}
                <time>{log.at}</time>
              </b>
              <p>{log.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
