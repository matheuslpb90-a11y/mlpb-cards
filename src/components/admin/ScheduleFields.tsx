"use client";

// Início (data + hora) e duração (dias/horas/minutos) — o fim é calculado sozinho.
// Datas no formato "AAAA-MM-DD" e horas "HH:MM" (horário de Brasília, sem fuso).

export type Schedule = { startDate: string; startTime: string; endDate: string; endTime: string };

const PRESETS: [string, number][] = [["30 min", 30], ["1 hora", 60], ["2 horas", 120], ["6 horas", 360], ["12 horas", 720], ["1 dia", 1440], ["3 dias", 4320], ["7 dias", 10080]];
const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const pad = (n: number) => String(n).padStart(2, "0");

function toMs(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  return y && m && d ? Date.UTC(y, m - 1, d, h || 0, mi || 0) : NaN;
}
function fromMs(ms: number) {
  const t = new Date(ms);
  return { date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`, time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` };
}

export function durationMinutes(s: Schedule) {
  const a = toMs(s.startDate, s.startTime), b = toMs(s.endDate, s.endTime);
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? Math.round((b - a) / 60000) : 0;
}

export function withDuration(s: Schedule, minutes: number): Schedule {
  const a = toMs(s.startDate, s.startTime);
  if (!Number.isFinite(a)) return s;
  const e = fromMs(a + Math.max(0, minutes) * 60000);
  return { ...s, endDate: e.date, endTime: e.time };
}

function Stepper({ label, value, max, onChange, disabled }: { label: string; value: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-1 py-1">
        <button type="button" disabled={disabled || value <= 0} className="px-2 py-1 text-xl disabled:opacity-30" onClick={() => onChange(value - 1)}>−</button>
        <input inputMode="numeric" disabled={disabled} className="w-10 bg-transparent text-center text-lg font-bold outline-none" value={value} onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0)))} />
        <button type="button" disabled={disabled || value >= max} className="px-2 py-1 text-xl disabled:opacity-30" onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

export function ScheduleFields({ value, onChange, disabled, defaultMinutes = 1440 }: { value: Schedule; onChange: (s: Schedule) => void; disabled?: boolean; defaultMinutes?: number }) {
  const mins = durationMinutes(value);
  const days = Math.floor(mins / 1440), hours = Math.floor((mins % 1440) / 60), minutes = mins % 60;
  const setDur = (d: number, h: number, m: number) => onChange(withDuration(value, d * 1440 + h * 60 + m));
  const setStart = (patch: Partial<Schedule>) => {
    const next = { ...value, ...patch };
    onChange(withDuration(next, mins || defaultMinutes)); // mantém a duração ao mudar o início
  };
  const end = toMs(value.endDate, value.endTime);
  const endLabel = Number.isFinite(end) && mins > 0 ? `${WEEK[new Date(end).getUTCDay()]}, ${value.endDate.split("-").reverse().join("/")} às ${value.endTime}` : "";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><span className="label">Dia de início *</span><input type="date" disabled={disabled} className="input" value={value.startDate} onChange={(e) => setStart({ startDate: e.target.value })} /></div>
        <div><span className="label">Horário de início *</span><input type="time" disabled={disabled} className="input" value={value.startTime} onChange={(e) => setStart({ startTime: e.target.value })} /></div>
      </div>
      <div>
        <span className="label">Duração do leilão *</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([label, m]) => (
            <button key={m} type="button" disabled={disabled} onClick={() => onChange(withDuration(value, m))}
              className={`rounded-full border px-3 py-1 text-sm ${mins === m ? "border-brand bg-brand font-bold text-black" : "border-slate-200 hover:border-brand"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stepper label="Dias" value={days} max={30} disabled={disabled} onChange={(n) => setDur(n, hours, minutes)} />
        <Stepper label="Horas" value={hours} max={23} disabled={disabled} onChange={(n) => setDur(days, n, minutes)} />
        <Stepper label="Minutos" value={minutes} max={59} disabled={disabled} onChange={(n) => setDur(days, hours, n)} />
      </div>
      <p className={`rounded-lg p-2 text-sm ${endLabel ? "bg-blue-950/40 text-blue-200" : "bg-amber-950/40 text-amber-300"}`}>
        {endLabel ? <>⏱️ Termina <strong>{endLabel}</strong> (horário de Brasília)</> : !value.startDate || !value.startTime ? "Escolha o dia e o horário de início." : "Escolha quanto tempo o leilão vai durar."}
      </p>
    </div>
  );
}
