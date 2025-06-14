import { GlobalStateManager } from '../GlobalStateManager'
import type { ISeriesApi, SeriesType } from 'lightweight-charts'

describe('GlobalStateManager', () => {
  let manager: GlobalStateManager<ISeriesApi<SeriesType>>
  const dummySeries = {} as unknown as ISeriesApi<SeriesType>

  beforeEach(() => {
    manager = new GlobalStateManager<ISeriesApi<SeriesType>>()
  })

  it('stores and cleans up entries for a pattern', () => {
    manager.registerMetricLines('p1', [dummySeries], 1)
    manager.registerSeries('s1', { patternId: 'p1', series: dummySeries, type: 'line', createdAt: Date.now() })

    expect(manager.getState().metricLineCount).toBe(1)
    expect(manager.getState().seriesCount).toBe(1)

    manager.cleanup('p1')

    expect(manager.getState().metricLineCount).toBe(0)
    expect(manager.getState().seriesCount).toBe(0)
  })

  it('forceCleanup clears all state', () => {
    manager.registerMetricLines('p1', [dummySeries], 1)
    manager.registerMetricLines('p2', [dummySeries], 2)
    manager.registerSeries('s1', { patternId: 'p1', series: dummySeries, type: 'metric', createdAt: Date.now() })
    manager.forceCleanup()
    expect(manager.getState().metricLineCount).toBe(0)
    expect(manager.getState().seriesCount).toBe(0)
  })
})
