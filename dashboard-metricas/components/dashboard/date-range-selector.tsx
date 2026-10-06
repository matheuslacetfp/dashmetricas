"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Period } from "@/lib/dashboard-period";

function toDayNumber(value: string) {
  return Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 86_400_000);
}

function fromDayNumber(value: number) {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

function formatRangeDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function DateRangeSelector({
  period,
  selectedDate,
  earliestDate,
  latestDate,
  initialStart,
  initialEnd,
  active,
}: {
  period: Period;
  selectedDate: string;
  earliestDate: string;
  latestDate: string;
  initialStart: string;
  initialEnd: string;
  active: boolean;
}) {
  const router = useRouter();
  const minimum = toDayNumber(earliestDate);
  const maximum = toDayNumber(latestDate);
  const [range, setRange] = useState({
    start: toDayNumber(initialStart),
    end: toDayNumber(initialEnd),
  });
  const rangeRef = useRef(range);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const nextRange = { start: toDayNumber(initialStart), end: toDayNumber(initialEnd) };
    rangeRef.current = nextRange;
    setRange(nextRange);
  }, [initialStart, initialEnd]);

  function updateRange(nextRange: { start: number; end: number }) {
    rangeRef.current = nextRange;
    setRange(nextRange);
  }

  function updateStart(value: number) {
    const currentRange = rangeRef.current;
    updateRange({ ...currentRange, start: Math.min(value, currentRange.end) });
  }

  function updateEnd(value: number) {
    const currentRange = rangeRef.current;
    updateRange({ ...currentRange, end: Math.max(value, currentRange.start) });
  }

  function applyRange() {
    const start = fromDayNumber(rangeRef.current.start);
    const end = fromDayNumber(rangeRef.current.end);
    if (start === initialStart && end === initialEnd && active) return;

    startTransition(() => {
      router.replace(
        `/?period=${period}&date=${selectedDate}&chartStart=${start}&chartEnd=${end}`,
        { scroll: false },
      );
    });
  }

  function resetRange() {
    startTransition(() => {
      router.replace(`/?period=${period}&date=${selectedDate}`, { scroll: false });
    });
  }

  const startPercent =
    maximum === minimum ? 0 : ((range.start - minimum) / (maximum - minimum)) * 100;
  const endPercent =
    maximum === minimum ? 100 : ((range.end - minimum) / (maximum - minimum)) * 100;
  const trackStyle = {
    "--range-start": `${startPercent}%`,
    "--range-end": `${endPercent}%`,
  } as CSSProperties;
  const labelsAreClose = endPercent - startPercent < 18;
  const startLabelPosition =
    startPercent <= 8 ? "date-range-label-start" : startPercent >= 92 ? "date-range-label-end" : "date-range-label-center";
  const endLabelPosition =
    endPercent <= 8 ? "date-range-label-start" : endPercent >= 92 ? "date-range-label-end" : "date-range-label-center";

  return (
    <section className="panel date-range-panel" aria-busy={isPending}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Zoom do gráfico</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Arraste as alças para escolher o intervalo. A escala muda de anos até dias.
          </p>
        </div>
        {active && (
          <button className="button-secondary" onClick={resetRange} type="button">
            Voltar à visão selecionada
          </button>
        )}
      </div>

      <div
        aria-live="polite"
        className={`date-range-values${labelsAreClose ? " date-range-values-close" : ""}`}
      >
        <span
          className={`date-range-selected-date date-range-selected-start ${startLabelPosition}`}
          style={{ left: `${startPercent}%` }}
        >
          {formatRangeDate(fromDayNumber(range.start))}
        </span>
        <span
          className={`date-range-selected-date date-range-selected-end ${endLabelPosition}`}
          style={{ left: `${endPercent}%` }}
        >
          {formatRangeDate(fromDayNumber(range.end))}
        </span>
      </div>

      <div className="date-range-control" style={trackStyle}>
        <div className="date-range-track" aria-hidden="true" />
        <input
          aria-label="Início do intervalo do gráfico"
          className="date-range-input date-range-start"
          disabled={minimum === maximum}
          max={maximum}
          min={minimum}
          onChange={(event) => updateStart(Number(event.target.value))}
          onKeyUp={applyRange}
          onPointerUp={applyRange}
          step={1}
          type="range"
          value={range.start}
        />
        <input
          aria-label="Fim do intervalo do gráfico"
          className="date-range-input date-range-end"
          disabled={minimum === maximum}
          max={maximum}
          min={minimum}
          onChange={(event) => updateEnd(Number(event.target.value))}
          onKeyUp={applyRange}
          onPointerUp={applyRange}
          step={1}
          type="range"
          value={range.end}
        />
      </div>

      <div className="date-range-bounds text-xs text-[var(--muted)]">
        <span>{formatRangeDate(earliestDate)}</span>
        <span>{formatRangeDate(latestDate)}</span>
      </div>
    </section>
  );
}
