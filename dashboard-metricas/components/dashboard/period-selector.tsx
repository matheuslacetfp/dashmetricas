"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Period } from "@/lib/dashboard-period";

const options: Array<{ value: Period; label: string }> = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
];

export function PeriodSelector({
  period,
  selectedDate,
}: {
  period: Period;
  selectedDate: string;
}) {
  const router = useRouter();
  const [activePeriod, setActivePeriod] = useState(period);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setActivePeriod(period);
  }, [period]);

  function selectPeriod(nextPeriod: Period) {
    if (nextPeriod === activePeriod) return;

    setActivePeriod(nextPeriod);
    startTransition(() => {
      router.push(`/?period=${nextPeriod}&date=${selectedDate}`, { scroll: false });
    });
  }

  const activeIndex = options.findIndex((option) => option.value === activePeriod);

  return (
    <nav
      aria-label="Selecionar período"
      aria-busy={isPending}
      className="period-switch"
      role="group"
    >
      <span
        aria-hidden="true"
        className="period-indicator"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {options.map(({ value, label }) => (
        <button
          aria-pressed={activePeriod === value}
          className="period-link"
          key={value}
          onClick={() => selectPeriod(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
