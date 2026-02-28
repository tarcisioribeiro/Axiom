import { useState, useEffect } from 'react';

/** Tailwind 'sm' breakpoint — screens below this are treated as mobile */
const MOBILE_BREAKPOINT = 640;

export interface ChartDimensions {
  /** true when viewport width is below the 'sm' breakpoint (640px) */
  isMobile: boolean;
  /** Axis tick font size: 10px on mobile, 12px on larger screens */
  fontSize: number;
  /** Single Y-axis width (line chart, horizontal bar): 40px on mobile, 60px on larger */
  yAxisWidth: number;
  /** Wide Y-axis width used for category labels in vertical bar charts: 80px on mobile, 120px on larger */
  yAxisWidthWide: number;
  /** Max characters for vertical-bar Y-axis category labels: 10 on mobile, 18 on larger */
  truncateYAxisLabel: number;
  /** Max characters for horizontal-bar X-axis category labels: 8 on mobile, 12 on larger */
  truncateXAxisLabel: number;
  /** XAxis height when tick labels are rotated: 45px on mobile, 60px on larger */
  xAxisHeightRotated: number;
  /** Pie chart outer radius: '75%' on mobile, '85%' on larger */
  pieOuterRadius: string;
}

const getDimensions = (width: number): ChartDimensions => {
  const isMobile = width < MOBILE_BREAKPOINT;
  return {
    isMobile,
    fontSize: isMobile ? 10 : 12,
    yAxisWidth: isMobile ? 40 : 60,
    yAxisWidthWide: isMobile ? 80 : 120,
    truncateYAxisLabel: isMobile ? 10 : 18,
    truncateXAxisLabel: isMobile ? 8 : 12,
    xAxisHeightRotated: isMobile ? 45 : 60,
    pieOuterRadius: isMobile ? '75%' : '85%',
  };
};

/**
 * Returns responsive chart dimension config that updates when the viewport resizes.
 *
 * Use this hook inside Recharts-based chart components to replace hard-coded
 * font sizes, axis widths, label truncation lengths and radii with values
 * that adapt to small screens.
 */
export const useChartDimensions = (): ChartDimensions => {
  const [dimensions, setDimensions] = useState<ChartDimensions>(() =>
    getDimensions(typeof window !== 'undefined' ? window.innerWidth : 1024)
  );

  useEffect(() => {
    const handleResize = () => setDimensions(getDimensions(window.innerWidth));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return dimensions;
};
