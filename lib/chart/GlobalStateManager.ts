export interface MetricLinesEntry<T> {
  series: T[];
  instanceId: number;
  createdAt: number;
}

export interface SeriesEntry<T> {
  patternId: string;
  series: T;
  type: 'marker' | 'line' | 'metric' | 'area';
  createdAt: number;
}

export interface GlobalStateSnapshot {
  metricLineCount: number;
  seriesCount: number;
  metricLineKeys: string[];
  seriesKeys: string[];
}

export class GlobalStateManager<T = unknown> {
  private metricLines = new Map<string, MetricLinesEntry<T>>();
  private allSeries = new Map<string, SeriesEntry<T>>();

  registerMetricLines(id: string, series: T[], instanceId: number): void {
    this.metricLines.set(id, { series, instanceId, createdAt: Date.now() });
  }

  registerSeries(id: string, entry: SeriesEntry<T>): void {
    this.allSeries.set(id, entry);
  }

  cleanup(patternId: string): void {
    for (const key of Array.from(this.metricLines.keys())) {
      if (key === patternId) {
        this.metricLines.delete(key);
      }
    }

    for (const [key, info] of Array.from(this.allSeries.entries())) {
      if (info.patternId === patternId) {
        this.allSeries.delete(key);
      }
    }
  }

  forceCleanup(): void {
    this.metricLines.clear();
    this.allSeries.clear();
  }

  getState(): GlobalStateSnapshot {
    return {
      metricLineCount: this.metricLines.size,
      seriesCount: this.allSeries.size,
      metricLineKeys: Array.from(this.metricLines.keys()),
      seriesKeys: Array.from(this.allSeries.keys()),
    };
  }

  /** Expose maps for internal usage */
  get metricLinesMap(): Map<string, MetricLinesEntry<T>> {
    return this.metricLines;
  }

  get allSeriesMap(): Map<string, SeriesEntry<T>> {
    return this.allSeries;
  }
}
