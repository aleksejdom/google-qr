'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Einzelserien-Balkendiagramm (validierte Farbe: #2a78d6 light / #3987e5 dark,
 * via currentColor umgeschaltet). Eine Serie – daher keine Legende.
 */
export function ScansChart({
  data,
  xKey,
  yKey,
}: {
  data: Record<string, string | number>[]
  xKey: string
  yKey: string
}) {
  return (
    <div className="h-64 w-full text-[#2a78d6] dark:text-[#3987e5]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: '#71717a' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#71717a' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e4e4e7',
              fontSize: 12,
            }}
          />
          <Bar dataKey={yKey} fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
