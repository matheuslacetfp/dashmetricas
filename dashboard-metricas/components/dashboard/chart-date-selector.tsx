"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Period } from "@/lib/dashboard-period";

const dateLabels: Record<Period, string> = {
  day: "Dia observado",
  week: "Semana de",
  month: "Mês observado",
  year: "Ano observado",
};

export function ChartDateSelector({
  period,
  selectedDate,
}: {
  period: Period;
  selectedDate: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(selectedDate);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDate(selectedDate);
  }, [selectedDate]);

  function changeDate(value: string) {
    if (!value) return;

    const nextDate =
      period === "year" ? `${value}-01-01` : period === "month" ? `${value}-01` : value;
    setDate(nextDate);
    startTransition(() => {
      router.push(`/?period=${period}&date=${nextDate}`, { scroll: false });
    });
  }

  const inputValue =
    period === "year"
      ? date.slice(0, 4)
      : period === "month"
        ? date.slice(0, 7)
        : date;

  return (
    <label className="chart-date-field">
      <span>{dateLabels[period]}</span>
      <input
        aria-busy={isPending}
        className="field chart-date-input"
        max={period === "year" ? "9999" : undefined}
        min={period === "year" ? "1900" : undefined}
        onChange={(event) => changeDate(event.target.value)}
        type={period === "year" ? "number" : period === "month" ? "month" : "date"}
        value={inputValue}
      />
    </label>
  );
}
