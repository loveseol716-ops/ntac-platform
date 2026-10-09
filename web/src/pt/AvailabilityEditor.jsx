import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked } from "./api.js";
import { periodFor } from "./tracking.js";
import { today } from "./model.js";
const defaults = {
  weekday_enabled: true,
  weekday_start: "09:00",
  weekday_end: "18:00",
  weekend_enabled: false,
  weekend_start: "09:00",
  weekend_end: "13:00",
};
export default function AvailabilityEditor({ coach, day, onApplied }) {
  const [mode, setMode] = useState("week"),
    [baseDay, setBaseDay] = useState(day),
    [settings, setSettings] = useState(defaults),
    [saved, setSaved] = useState(defaults),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  useEffect(() => setBaseDay(day), [day]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setMessage("");
    checked(
      supabase
        .from("pt_availability_defaults")
        .select("*")
        .eq("coach_id", coach)
        .maybeSingle(),
    )
      .then((row) => {
        if (live) {
          const value = { ...defaults };
          for (const k of Object.keys(value))
            if (row?.[k] != null) value[k] = row[k];
          setSettings(value);
          setSaved(value);
        }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [coach]);
  const period = periodFor(baseDay, mode);
  function validate() {
    for (const prefix of ["weekday", "weekend"]) {
      if (!settings[`${prefix}_enabled`]) continue;
      const minutes = (t) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        },
        length =
          minutes(settings[`${prefix}_end`]) -
          minutes(settings[`${prefix}_start`]);
      if (!Number.isFinite(length) || length <= 0 || length % 60)
        throw Error("시작·종료 시간을 60분 단위 범위로 입력해 주세요.");
    }
  }
  async function act(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      validate();
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function patch(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }
  return (
    <details className="availability-editor bulk-availability">
      <summary>예약 가능 시간 설정</summary>
      <p className="pt-muted">
        평일·주말 시간을 정하고 선택한 기간에 한 번에 적용하세요.
      </p>
      {error && (
        <p role="alert" className="pt-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="pt-success">
          {message}
        </p>
      )}
      <fieldset disabled={busy || loading}>
        <div className="range-tabs" aria-label="설정 단위">
          {[
            ["day", "하루"],
            ["week", "주간"],
            ["month", "월간"],
          ].map(([v, label]) => (
            <button
              type="button"
              key={v}
              className={mode === v ? "selected" : ""}
              aria-pressed={mode === v}
              onClick={() => setMode(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          {mode === "month" ? "설정할 월" : "기준 날짜"}
          <input
            type={mode === "month" ? "month" : "date"}
            value={mode === "month" ? baseDay.slice(0, 7) : baseDay}
            onChange={(e) => {
              if (e.target.value)
                setBaseDay(
                  mode === "month" ? `${e.target.value}-01` : e.target.value,
                );
            }}
          />
        </label>
        <p className="period-preview">
          {period.first} ~ {period.last}
          {mode === "week" ? " · 월~일" : ""}
        </p>
        {[
          ["weekday", "평일 · 월–금"],
          ["weekend", "주말 · 토–일"],
        ].map(([prefix, label]) => (
          <div className="default-time-block" key={prefix}>
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={settings[`${prefix}_enabled`]}
                onChange={(e) => patch(`${prefix}_enabled`, e.target.checked)}
              />
              {label}
              <span>
                {settings[`${prefix}_enabled`] ? "예약 가능" : "휴무"}
              </span>
            </label>
            {settings[`${prefix}_enabled`] && (
              <div className="pt-two">
                <label>
                  {prefix === "weekday" ? "평일 시작" : "주말 시작"}
                  <input
                    type="time"
                    value={settings[`${prefix}_start`].slice(0, 5)}
                    onChange={(e) => patch(`${prefix}_start`, e.target.value)}
                  />
                </label>
                <label>
                  {prefix === "weekday" ? "평일 종료" : "주말 종료"}
                  <input
                    type="time"
                    value={settings[`${prefix}_end`].slice(0, 5)}
                    onChange={(e) => patch(`${prefix}_end`, e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        ))}
        <div className="pt-row">
          <button
            type="button"
            onClick={() =>
              act(async () => {
                await checked(
                  supabase
                    .from("pt_availability_defaults")
                    .upsert(
                      { coach_id: coach, ...settings },
                      { onConflict: "coach_id" },
                    ),
                );
                setSaved({ ...settings });
                setMessage(
                  "평일·주말 기본 시간을 저장했어요. 원하는 기간을 선택해 적용해 주세요.",
                );
              })
            }
          >
            기본값 저장
          </button>
          <button
            type="button"
            onClick={() => {
              setSettings({ ...saved });
              setMessage("저장된 기본 시간을 불러왔어요.");
            }}
          >
            기본값 불러오기
          </button>
        </div>
        <p className="pt-muted">
          적용하면 이 기간의 기존 예약 가능 시간을 바꿉니다. 이미 예약된 수업은
          유지되며, 지난 시간은 바뀌지 않습니다.
        </p>
        <button
          className="pt-primary apply-range"
          type="button"
          disabled={period.last < today()}
          onClick={() =>
            act(async () => {
              await checked(
                supabase.rpc("pt_apply_availability", {
                  target_coach: coach,
                  first_day: period.first,
                  last_day: period.last,
                  settings,
                }),
              );
              setMessage(`${period.first} ~ ${period.last} 설정을 적용했어요.`);
              onApplied();
            })
          }
        >
          {busy
            ? "저장 중…"
            : `${mode === "day" ? "선택한 날짜" : mode === "week" ? "선택한 주" : "선택한 달"}에 적용`}
        </button>
      </fieldset>
    </details>
  );
}
