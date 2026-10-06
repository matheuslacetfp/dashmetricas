import type { ChartPoint } from "@/lib/dashboard-period";

type ProductionChartProps = {
  points: ChartPoint[];
  title: string;
  description: string;
  comparison?: boolean;
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
  const yesterday = points[0]?.value ?? 0;
  const today = points[1]?.value ?? 0;
  const difference = today - yesterday;

  if (difference === 0) return `Mesmo volume de ontem: ${formatCount(today)} cortes.`;
  if (difference > 0) return `${formatCount(difference)} a mais que ontem.`;
  return `${formatCount(Math.abs(difference))} a menos que ontem.`;
}

export function ProductionChart({
  points,
  title,
  description,
  comparison = false,
}: ProductionChartProps) {
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const gridValues = [...new Set([maxValue, Math.ceil(maxValue / 2), 0])];
  const labelInterval = Math.max(1, Math.ceil(points.length / 12));
  const plottedPoints = points.map((point, index) => ({
    point,
    x: points.length === 1 ? left + plotWidth / 2 : left + (plotWidth * index) / (points.length - 1),
    y: top + plotHeight - (point.value / maxValue) * plotHeight,
  }));
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
            .map((point) => `${point.label}: ${formatCount(point.value)} cortes`)
            .join("; ")}`}
          className="h-auto min-w-[560px] w-full"
          role="img"
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

          {plottedPoints.map(({ point, x, y }, index) => {
            const showLabel =
              points.length <= 12 || index % labelInterval === 0 || index === points.length - 1;

            return (
              <g key={point.date}>
                <circle
                  className="chart-point"
                  cx={x}
                  cy={y}
                  r={comparison && index === 1 ? 5 : 3.5}
                  style={{ animationDelay: `${Math.min(index * 18, 300)}ms` }}
                />
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
