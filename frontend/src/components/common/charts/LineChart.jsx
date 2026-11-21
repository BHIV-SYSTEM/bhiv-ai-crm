import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import Card, { CardHeader, CardTitle, CardContent } from '../ui/Card';

export const LineChart = ({ 
  title, 
  data = [], 
  lines = [],
  height = 300,
  className 
}) => {
  const palette = [
    { stroke: '#3b82f6', fill: 'url(#gradient-primary)' },
    { stroke: '#10b981', fill: 'url(#gradient-secondary)' },
    { stroke: '#8b5cf6', fill: 'url(#gradient-accent)' },
    { stroke: '#f59e0b', fill: 'url(#gradient-info)' },
  ];

  return (
    <Card className={className}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {title}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
            {lines.map((line, idx) => (
              <span key={line.dataKey} className="flex items-center gap-1.5 font-semibold">
                <span 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: line.color || palette[idx % palette.length].stroke }}
                />
                {line.name || line.dataKey}
              </span>
            ))}
          </div>
        </CardHeader>
      )}
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="gradient-primary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradient-secondary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradient-accent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradient-info" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
              axisLine={{ stroke: '#cbd5e1', opacity: 0.5 }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: '#334155',
                borderRadius: '0.75rem',
                color: '#f8fafc',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                fontSize: '12px',
                backdropFilter: 'blur(8px)',
              }}
              labelStyle={{ color: '#e2e8f0', fontWeight: '600', marginBottom: '4px' }}
            />
            {lines.map((line, idx) => (
              <Area
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name || line.dataKey}
                stroke={line.color || palette[idx % palette.length].stroke}
                strokeWidth={2.5}
                fill={palette[idx % palette.length].fill}
                dot={{ r: 3, fill: line.color || palette[idx % palette.length].stroke, strokeWidth: 1 }}
                activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default LineChart;

