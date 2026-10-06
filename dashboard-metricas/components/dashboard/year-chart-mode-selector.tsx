"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type YearChartMode = "monthly" | "totals";

const options: Array<{ value: YearChartMode; label: string }> = [
  { value: "monthly", label: "Por mês" },
  { value: "totals", label: "Total por ano" },
];

export function YearChartModeSelector({
  mode,
  selectedDate,
}: {
  mode: YearChartMode;
  selectedDate: string;
}) {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState(mode);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);

  function selectMode(nextMode: YearChartMode) {
    if (nextMode === activeMode) return;

    setActiveMode(nextMode);
    const yearView = nextMode === "totals" ? "&yearView=totals" : "";
    startTransition(() => {
      router.push(`/?period=year&date=${selectedDate}${yearView}`, { scroll: false });
    });
  }

  return (
    <nav
      aria-busy={isPending}
      aria-label="Visualização do gráfico anual"
      className="mode-switch"
      role="group"
    >
      {options.map(({ value, label }) => (
        <button
          aria-pressed={activeMode === value}
          key={value}
          onClick={() => selectMode(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
