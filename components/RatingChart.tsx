import { PlusCircle } from 'lucide-react';
import React from 'react';

interface RatingDataPoint {
  rating: number;
  matchNumber: number;
}

interface RatingChartProps {
  data: RatingDataPoint[];
  currentRating: number;
  lastRatingChange?: number | null;
}

export const RatingChart: React.FC<RatingChartProps> = ({ data, currentRating, lastRatingChange }) => {
  if (!data || data.length === 0) {
    const w = 320;
    const h = 80;
    const pad = { top: 10, right: 10, bottom: 10, left: 35 };
    const midY = pad.top + (h - pad.top - pad.bottom) / 2;
    const ticks = [480, 500, 520];

    return (
      <div className="w-full bg-gray-900 border border-gray-700/30 rounded-3xl p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-1">
          <span className="text-gray-500 text-[10px] font-mono tracking-widest uppercase">YOUR RATING</span>
          <span className="text-gray-500 text-[10px] font-mono tracking-wider uppercase">LAST 20 MATCHES</span>
        </div>
        {/* Rating number */}
        <div className="flex items-center mb-3">
          <span className="text-gray-300 font-black text-3xl font-mono">{currentRating}</span>
        </div>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible" style={{ backgroundColor: '#111827' }}>
          <defs>
            <linearGradient id="ratingGradientEmpty" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(33, 189, 90, 0.15)" />
              <stop offset="100%" stopColor="rgba(33, 189, 90, 0)" />
            </linearGradient>
          </defs>

          {/* Y-axis labels only */}
          {ticks.map((tick, i) => {
            const y = pad.top + (h - pad.top - pad.bottom) - ((tick - 480) / 40) * (h - pad.top - pad.bottom);
            return (
              <text key={i} x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280" fontFamily="monospace">{tick}</text>
            );
          })}

          {/* Area fill below the flat line */}
          <path
            d={`M ${pad.left} ${midY} L ${w - pad.right} ${midY} L ${w - pad.right} ${h - pad.bottom} L ${pad.left} ${h - pad.bottom} Z`}
            fill="url(#ratingGradientEmpty)"
          />

          {/* Flat line at 500 */}
          <line x1={pad.left} y1={midY} x2={w - pad.right} y2={midY} stroke="#21bd5a" strokeWidth="2" strokeDasharray="6 4" opacity="0.5" />
        </svg>
        <p className="text-gray-500 text-xs text-center mt-2 font-mono">Play to see your rating progression</p>
      </div>
    );
  }

  const width = 320;
  const height = 80;
  const padding = { top: 10, right: 10, bottom: 10, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate min/max for Y axis with some padding
  const ratings = data.map(d => d.rating);
  const minRating = Math.max(100, Math.min(...ratings) - 20);
  const maxRating = Math.max(...ratings) + 20;
  const ratingRange = maxRating - minRating;

  // Use explicit lastRatingChange prop if available (most accurate, from game over screen),
  // otherwise estimate from chart data points
  let ratingChange = 0;
  if (lastRatingChange != null) {
    ratingChange = lastRatingChange;
  } else if (data.length >= 2) {
    ratingChange = data[data.length - 1].rating - data[data.length - 2].rating;
  } else if (data.length === 1) {
    ratingChange = data[0].rating - 500;
  }

  // Create SVG path for the line
  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.rating - minRating) / ratingRange) * chartHeight;
    return { x, y, rating: d.rating, matchNumber: d.matchNumber };
  });

  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');

  // Create gradient fill area
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  // Y-axis labels (show 3 tick marks)
  const numTicks = 3;
  const yTicks = Array.from({ length: numTicks }, (_, i) => {
    const value = minRating + (ratingRange / (numTicks - 1)) * i;
    const y = padding.top + chartHeight - ((value - minRating) / ratingRange) * chartHeight;
    return { value: Math.round(value), y };
  });

  return (
    <div className="w-full bg-gray-900 border border-gray-700/30 rounded-3xl p-4">
      {/* Header row */}
      <div className="flex items-start justify-between mb-1">
        <span className="text-gray-500 text-[10px] font-mono tracking-widest uppercase">YOUR RATING</span>
        <span className="text-gray-500 text-[10px] font-mono tracking-wider uppercase">LAST {data.length} MATCHES</span>
      </div>
      {/* Rating number */}
      <div className="flex items-center mb-3">
        <span className="text-gray-300 font-black text-3xl font-mono">{currentRating}</span>
        {ratingChange !== 0 && (
          <span className={`ml-1 flex items-center font-bold text-sm rating-change-pop ${ratingChange > 0 ? 'text-lime-400' : 'text-red-400'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {ratingChange > 0 ? (
                <><path d="M7 7h10v10"/><path d="M7 17 17 7"/></>
              ) : (
                <><path d="M7 7v10h10"/><path d="M17 7 7 17"/></>
              )}
            </svg>
            <span className="ml-0.5">{Math.abs(ratingChange)}</span>
          </span>
        )}
      </div>

      {/* SVG Chart */}
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible" style={{ backgroundColor: '#111827' }}>
        <defs>
          {/* Gradient for area fill */}
          <linearGradient id="ratingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(33, 189, 90, 0.3)" />
            <stop offset="100%" stopColor="rgba(33, 189, 90, 0)" />
          </linearGradient>
        </defs>


        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#ratingGradient)"
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#21bd5a"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="3"
              fill="#33e67d"
              stroke="#0a0f0a"
              strokeWidth="1.5"
              className={`rating-point rating-point-${i}`}
            />
            {/* Highlight last point (current rating) */}
            {i === points.length - 1 && (
              <circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                className="rating-current-glow"
              />
            )}
          </g>
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            fontSize="10"
            fill="#6b7280"
            fontFamily="monospace"
          >
            {tick.value}
          </text>
        ))}
      </svg>
    </div>
  );
};
