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

const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function ChartDateSelector({
  period,
  selectedDate,
  preserveYearTotals = false,
}: {
  period: Period;
  selectedDate: string;
  preserveYearTotals?: boolean;
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
    const yearView = preserveYearTotals ? "&yearView=totals" : "";
    startTransition(() => {
      router.push(`/?period=${period}&date=${nextDate}${yearView}`, { scroll: false });
    });
  }

  function changeMonth(month: string) {
    changeDate(`${date.slice(0, 4)}-${month}`);
  }

  function changeMonthYear(year: string) {
    if (!/^\d{4}$/.test(year)) return;
    changeDate(`${year}-${date.slice(5, 7)}`);
  }

  const inputValue =
    period === "year"
      ? date.slice(0, 4)
      : period === "month"
        ? date.slice(0, 7)
        : date;
  const fieldLabel = preserveYearTotals ? "Ano do KPI" : dateLabels[period];

  return (
    <div className="chart-date-field">
      <span>{fieldLabel}</span>
      {period === "month" ? (
        <div aria-busy={isPending} className="chart-month-inputs">
          <select
            aria-label="Mês observado"
            className="field chart-month-select"
            onChange={(event) => changeMonth(event.target.value)}
            value={date.slice(5, 7)}
          >
            {months.map((month, index) => (
              <option key={month} value={String(index + 1).padStart(2, "0")}>
                {month}
              </option>
            ))}
          </select>
          <input
            aria-label="Ano observado"
            className="field chart-month-year"
            max="9999"
            min="1900"
            onChange={(event) => changeMonthYear(event.target.value)}
            type="number"
            value={date.slice(0, 4)}
          />
        </div>
      ) : (
        <input
          aria-busy={isPending}
          aria-label={fieldLabel}
          className="field chart-date-input"
          max={period === "year" ? "9999" : undefined}
          min={period === "year" ? "1900" : undefined}
          onChange={(event) => changeDate(event.target.value)}
          type={period === "year" ? "number" : "date"}
          value={inputValue}
        />
      )}
    </div>
  );
}
