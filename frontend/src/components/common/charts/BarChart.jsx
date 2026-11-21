import React from 'react';
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import Card, { CardHeader, CardTitle, CardContent } from '../ui/Card';

export const BarChart = ({ 
  title, 
  data = [], 
  bars = [],
  height = 300,
  className 
}) => {
  const palette = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4'];

  return (
    <Card className={className}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {title}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
            {bars.map((bar, idx) => (
              <span key={bar.dataKey} className="flex items-center gap-1.5 font-semibold">
                <span 
                  className="w-2.5 h-2.5 rounded-xs" 
                  style={{ backgroundColor: bar.color || palette[idx % palette.length] }}
                />
                {bar.name || bar.dataKey}
              </span>
            ))}
          </div>
        </CardHeader>
      )}
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart data={data} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}>
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
              cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
            />
            {bars.map((bar, idx) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.name || bar.dataKey}
                fill={bar.color || palette[idx % palette.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default BarChart;

