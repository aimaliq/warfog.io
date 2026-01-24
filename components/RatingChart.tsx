import { PlusCircle } from 'lucide-react';
import React from 'react';

interface RatingDataPoint {
  rating: number;
  matchNumber: number;
}

interface RatingChartProps {
  data: RatingDataPoint[];
  currentRating: number;
}

export const RatingChart: React.FC<RatingChartProps> = ({ data, currentRating }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-32 flex items-center justify-center bg-black/40 border border-lime-900/30 rounded">
        <span className="text-gray-600 text-xs">Play matches to see your rating progression</span>
      </div>
    );
  }

  const width = 320;
  const height = 120;
  const padding = { top: 15, right: 15, bottom: 25, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate min/max for Y axis with some padding
  const ratings = data.map(d => d.rating);
  const minRating = Math.max(100, Math.min(...ratings) - 20);
  const maxRating = Math.max(...ratings) + 20;
  const ratingRange = maxRating - minRating;

  // Calculate rating change from last match
  let ratingChange = 0;
  if (data.length >= 2) {
    const lastRating = data[data.length - 1].rating;
    const previousRating = data[data.length - 2].rating;
    ratingChange = lastRating - previousRating;
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

  // Y-axis labels (show 3-4 tick marks)
  const numTicks = 4;
  const yTicks = Array.from({ length: numTicks }, (_, i) => {
    const value = minRating + (ratingRange / (numTicks - 1)) * i;
    const y = padding.top + chartHeight - ((value - minRating) / ratingRange) * chartHeight;
    return { value: Math.round(value), y };
  });

  return (
    <div className="w-full bg-black/40 border border-lime-900/30 rounded p-3">
      {/* Header */}
      <div className="flex items-center mb-2">
        <span className="text-gray-300 block text-sm">Your Rating</span>
        <span className="text-yellow-500 font-bold text-xl ml-2">{currentRating}</span>
        {ratingChange !== 0 && (
          <span className={`ml-1 flex items-center font-bold text-sm ${ratingChange > 0 ? 'text-lime-400' : 'text-red-400'}`}>
            <span className="material-icons-outlined text-base">
              {ratingChange > 0 ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {Math.abs(ratingChange)}
          </span>
        )}
      </div>

      {/* SVG Chart */}
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          {/* Gradient for area fill */}
          <linearGradient id="ratingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(132, 204, 22, 0.3)" />
            <stop offset="100%" stopColor="rgba(132, 204, 22, 0)" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke="rgba(132, 204, 22, 0.1)"
            strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#ratingGradient)"
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#84cc16"
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
              fill="#84cc16"
              stroke="#0a0f0a"
              strokeWidth="1.5"
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
            fontSize="15"
            fill="#898c94"
            fontFamily="monospace"
          >
            {tick.value}
          </text>
        ))}

        {/* X-axis label */}
        <text
          x={width / 2}
          y={height - 5}
          textAnchor="middle"
          fontSize="15"
          fill="#d8d8d8"
          fontFamily="monospace"
        >
          Last {data.length} matches
        </text>
      </svg>
    </div>
  );
};
