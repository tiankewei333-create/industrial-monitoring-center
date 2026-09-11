import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { DEFAULT_THRESHOLDS, type HistorySample } from "@imc/shared-types";

export type MetricKey = "temperature" | "speed" | "power";

const META: Record<
  MetricKey,
  { label: string; unit: string; color: string; threshold?: number }
> = {
  temperature: {
    label: "Temperature",
    unit: "°C",
    color: "#7db7ff",
    threshold: DEFAULT_THRESHOLDS.temperatureMaxC,
  },
  speed: { label: "Speed", unit: "rpm", color: "#8ce99a" },
  power: {
    label: "Power",
    unit: "kW",
    color: "#ffd43b",
    threshold: DEFAULT_THRESHOLDS.powerMaxKw,
  },
};

export function MetricChart({
  samples,
  metric,
}: {
  samples: HistorySample[];
  metric: MetricKey;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!elRef.current) return;
    const chart = echarts.init(elRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const meta = META[metric];
    chart.setOption({
      backgroundColor: "transparent",
      textStyle: { color: "#93a0b8" },
      grid: { left: 52, right: 18, top: 36, bottom: 36 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#151d2f",
        borderColor: "#243049",
        textStyle: { color: "#e8eefc" },
      },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "#243049" } },
        axisLabel: { color: "#93a0b8" },
      },
      yAxis: {
        type: "value",
        name: meta.unit,
        nameTextStyle: { color: "#93a0b8" },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#243049" } },
        axisLabel: { color: "#93a0b8" },
      },
      series: [
        {
          type: "line",
          name: meta.label,
          showSymbol: samples.length < 3,
          data: samples.map((s) => [s.ts, s[metric]]),
          lineStyle: { color: meta.color, width: 2 },
          itemStyle: { color: meta.color },
          areaStyle: { color: `${meta.color}22` },
          markLine: meta.threshold
            ? {
                silent: true,
                symbol: "none",
                data: [{ yAxis: meta.threshold }],
                lineStyle: { color: "#c92a2a", type: "dashed" },
                label: {
                  formatter: `thr ${meta.threshold}`,
                  color: "#ff8787",
                },
              }
            : undefined,
        },
      ],
    });
  }, [samples, metric]);

  return (
    <div
      ref={elRef}
      className="metric-chart"
      role="img"
      aria-label={`${META[metric].label} history`}
    />
  );
}
