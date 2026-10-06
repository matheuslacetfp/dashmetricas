export const periodLabels = {
  day: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  year: "Este ano",
} as const;

export type Period = keyof typeof periodLabels;

export function isPeriod(value: string | undefined): value is Period {
  return value !== undefined && Object.hasOwn(periodLabels, value);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isValidDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && formatDate(date) === value;
}

export function getSelectedDate(value: string | undefined, now = new Date()) {
  if (isValidDate(value)) return value;
  return formatDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
}

export function getPeriodBounds(period: Period, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let end: Date;

  if (period === "day") {
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (period === "week") {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (period === "month") {
    start.setUTCDate(1);
    end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  } else {
    start.setUTCMonth(0, 1);
    end = new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
  }

  const lastDay = new Date(end);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);

  return {
    start: formatDate(start),
    end: formatDate(end),
    lastDay: formatDate(lastDay),
  };
}

export function getChartQueryBounds(period: Period, start: string, end: string) {
  if (period !== "day") return { start, end };

  const previousDay = new Date(`${start}T00:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  return {
    start: formatDate(previousDay),
    end,
  };
}

export type DailyCount = {
  rendered_on: string;
  cut_count: number | string;
};

export type ChartPoint = {
  label: string;
  value: number;
  date: string;
};

export type RangeGranularity = "day" | "week" | "month" | "year";

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function addDateDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function getRangeBucketDate(value: string, granularity: RangeGranularity) {
  const date = parseDate(value);
  if (granularity === "year") date.setUTCMonth(0, 1);
  if (granularity === "month") date.setUTCDate(1);
  if (granularity === "week") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return formatDate(date);
}

export function getRangeGranularity(start: string, end: string): RangeGranularity {
  const days =
    (parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000 + 1;
  if (days > 730) return "year";
  if (days > 90) return "month";
  if (days > 14) return "week";
  return "day";
}

export function buildRangeChartPoints(
  start: string,
  end: string,
  granularity: RangeGranularity,
  rows: DailyCount[],
): ChartPoint[] {
  const countsByDate = new Map(rows.map((row) => [row.rendered_on, Number(row.cut_count)] as const));
  const points: ChartPoint[] = [];
  let bucketDate = getRangeBucketDate(start, granularity);
  const lastBucketDate = getRangeBucketDate(end, granularity);
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  });

  while (bucketDate <= lastBucketDate) {
    const date = parseDate(bucketDate);
    const label =
      granularity === "year"
        ? bucketDate.slice(0, 4)
        : granularity === "month"
          ? `${monthFormatter.format(new Date(`${bucketDate}T12:00:00Z`)).replace(".", "")}/${bucketDate.slice(2, 4)}`
          : granularity === "week"
            ? `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`
            : String(date.getUTCDate());

    points.push({ label, value: countsByDate.get(bucketDate) ?? 0, date: bucketDate });

    if (granularity === "year") date.setUTCFullYear(date.getUTCFullYear() + 1);
    else if (granularity === "month") date.setUTCMonth(date.getUTCMonth() + 1);
    else date.setUTCDate(date.getUTCDate() + (granularity === "week" ? 7 : 1));
    bucketDate = formatDate(date);
  }

  return points;
}

export function buildYearlyTotalPoints(rows: DailyCount[]): ChartPoint[] {
  return rows.map((row) => ({
    label: row.rendered_on.slice(0, 4),
    value: Number(row.cut_count),
    date: row.rendered_on,
  }));
}

export function buildChartPoints(period: Period, start: string, rows: DailyCount[]): ChartPoint[] {
  const countsByDate = new Map(
    rows.map((row) => [row.rendered_on, Number(row.cut_count)] as const),
  );

  if (period === "day") {
    const today = new Date(`${start}T00:00:00Z`);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = formatDate(yesterday);

    return [
      { label: "Ontem", value: countsByDate.get(yesterdayKey) ?? 0, date: yesterdayKey },
      { label: "Hoje", value: countsByDate.get(start) ?? 0, date: start },
    ];
  }

  if (period === "year") {
    const year = Number(start.slice(0, 4));
    const formatter = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

    return Array.from({ length: 12 }, (_, month) => {
      const date = formatDate(new Date(Date.UTC(year, month, 1)));
      return {
        label: formatter.format(new Date(`${date}T12:00:00Z`)).replace(".", ""),
        value: [...countsByDate.entries()]
          .filter(([renderedOn]) => renderedOn.startsWith(date.slice(0, 7)))
          .reduce((total, [, value]) => total + value, 0),
        date,
      };
    });
  }

  const startDate = new Date(`${start}T00:00:00Z`);
  const dayCount = period === "week" ? 7 : new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  });

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + index);
    const dateKey = formatDate(date);

    return {
      label:
        period === "week"
          ? weekdayFormatter.format(new Date(`${dateKey}T12:00:00Z`)).replace(".", "")
          : String(date.getUTCDate()),
      value: countsByDate.get(dateKey) ?? 0,
      date: dateKey,
    };
  });
}
