import type { ChartPoint, Period, RangeGranularity } from "@/lib/dashboard-period";

type ProductionChartProps = {
  points: ChartPoint[];
  title: string;
  description: string;
  period: Period;
  comparison?: boolean;
  yearlyTotals?: boolean;
  rangeGranularity?: RangeGranularity;
};

const chartWidth = 760;
const chartHeight = 248;
const left = 42;
const right = 14;
const top = 16;
const bottom = 38;

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPointDate(
  value: string,
  period: Period,
  rangeGranularity?: RangeGranularity,
) {
  const date = new Date(`${value}T12:00:00Z`);
  if (rangeGranularity === "year") return value.slice(0, 4);
  if (rangeGranularity === "month") {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  const monthView = period === "year" && rangeGranularity === undefined;
  return new Intl.DateTimeFormat("pt-BR", {
    ...(monthView ? {} : { weekday: "short", day: "numeric" }),
    month: monthView ? "long" : "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = (point.x - previous.x) / 2;
    return `${path} C ${previous.x + controlX} ${previous.y}, ${point.x - controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function comparisonText(points: ChartPoint[]) {
  const previousDay = points[0]?.value ?? 0;
  const selectedDay = points[1]?.value ?? 0;
  const difference = selectedDay - previousDay;

  if (difference === 0) return `Mesmo volume do dia anterior: ${formatCount(selectedDay)} cortes.`;
  if (difference > 0) return `${formatCount(difference)} a mais que no dia anterior.`;
  return `${formatCount(Math.abs(difference))} a menos que no dia anterior.`;
}

export function ProductionChart({
  points,
  title,
  description,
  period,
  comparison = false,
  yearlyTotals = false,
  rangeGranularity,
}: ProductionChartProps) {
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const gridValues = [...new Set([maxValue, Math.ceil(maxValue / 2), 0])];
  const labelInterval = Math.max(1, Math.ceil(points.length / 12));
  const tooltipWidth = 208;
  const tooltipHeight = 46;
  const plottedPoints = points.map((point, index) => {
    const x =
      points.length === 1 ? left + plotWidth / 2 : left + (plotWidth * index) / (points.length - 1);
    const y = top + plotHeight - (point.value / maxValue) * plotHeight;
    return {
      point,
      x,
      y,
      tooltipX: Math.min(
        Math.max(x - tooltipWidth / 2, left),
        chartWidth - right - tooltipWidth,
      ),
      tooltipY: y >= tooltipHeight + 12 ? y - tooltipHeight - 8 : y + 12,
      dateLabel: yearlyTotals
        ? point.date.slice(0, 4)
        : formatPointDate(point.date, period, rangeGranularity),
      countLabel: `${formatCount(point.value)} ${point.value === 1 ? "corte" : "cortes"}`,
    };
  });
  const linePath = smoothPath(plottedPoints);
  const areaPath =
    plottedPoints.length > 0
      ? `${linePath} L ${plottedPoints[plottedPoints.length - 1].x} ${top + plotHeight} L ${plottedPoints[0].x} ${top + plotHeight} Z`
      : "";

  return (
    <section className="panel p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
        {comparison && (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--green-soft)] px-3 py-2 text-sm font-semibold text-[var(--green-dark)]">
            {comparisonText(points)}
          </div>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        <svg
          aria-label={`${title}. ${points
            .map((point) => `${point.label}, ${yearlyTotals ? point.date.slice(0, 4) : formatPointDate(point.date, period, rangeGranularity)}: ${formatCount(point.value)} cortes`)
            .join("; ")}`}
          className="h-auto min-w-[560px] w-full"
          role="group"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <defs>
            <linearGradient id="production-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#b9f34a" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#b9f34a" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridValues.map((value, index) => {
            const y = top + (plotHeight * index) / (gridValues.length - 1);
            return (
              <g key={`${value}-${index}`}>
                <line
                  className="chart-gridline"
                  strokeDasharray={index === gridValues.length - 1 ? undefined : "3 5"}
                  x1={left}
                  x2={chartWidth - right}
                  y1={y}
                  y2={y}
                />
                <text
                  fill="var(--muted)"
                  fontSize="11"
                  textAnchor="end"
                  x={left - 9}
                  y={y + 4}
                >
                  {formatCount(value)}
                </text>
              </g>
            );
          })}

          <path className="chart-area" d={areaPath} />
          <path className="chart-line" d={linePath} />

          {plottedPoints.map(({ point, x, y, tooltipX, tooltipY, dateLabel, countLabel }, index) => {
            const showLabel =
              points.length <= 12 || index % labelInterval === 0 || index === points.length - 1;
            const accessibleLabel = `${point.label}, ${dateLabel}: ${countLabel}`;

            return (
              <g key={point.date}>
                <g
                  aria-label={accessibleLabel}
                  className="chart-data-point"
                  role="img"
                  tabIndex={0}
                >
                  <title>{accessibleLabel}</title>
                  <circle
                    className="chart-point"
                    cx={x}
                    cy={y}
                    r={comparison && index === 1 ? 5 : 3.5}
                    style={{ animationDelay: `${Math.min(index * 18, 300)}ms` }}
                  />
                  <g
                    aria-hidden="true"
                    className="chart-tooltip"
                    transform={`translate(${tooltipX} ${tooltipY})`}
                  >
                    <rect height={tooltipHeight} rx="8" width={tooltipWidth} x="0" y="0" />
                    <text className="chart-tooltip-date" x="10" y="18">
                      {dateLabel}
                    </text>
                    <text className="chart-tooltip-count" x="10" y="36">
                      {countLabel}
                    </text>
                  </g>
                </g>
                {showLabel && (
                  <text
                    fill="var(--muted)"
                    fontSize="11"
                    textAnchor="middle"
                    x={x}
                    y={chartHeight - 10}
                  >
                    {point.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
