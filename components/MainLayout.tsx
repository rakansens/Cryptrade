'use client'

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import ChartToolbar from '@/components/chart/toolbar/ChartToolbar'
import CandlestickChart, { type CandlestickChartRef } from '@/components/chart/core/CandlestickChart'
import IndicatorPanel from '@/components/chart/indicators/IndicatorPanel'
import RsiChart from '@/components/chart/indicators/RsiChart'
import MacdChart from '@/components/chart/indicators/MacdChart'
import { useChart } from '@/store/chart.store'
import { useRef, useCallback } from 'react'

interface MainLayoutProps {
  children?: React.ReactNode // For chat sidebar
}

export function MainLayout({ children }: MainLayoutProps) {
  const { indicators } = useChart()
  const chartRef = useRef<CandlestickChartRef>(null)

  const handleFitContent = useCallback(() => {
    chartRef.current?.fitContent()
  }, [])

  // Create chart component with stable key to prevent remounting
  const chartComponent = (
    <div className="h-full overflow-hidden">
      <CandlestickChart key="main-chart" ref={chartRef} />
    </div>
  )
  
  return (
    <div className="h-screen flex bg-[hsl(var(--color-base))]">
      {/* Main Content Area - Chat + Chart */}
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Chat Area - 左側 */}
        {children && (
          <>
            <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
              {children}
            </ResizablePanel>
            
            {/* Resizable Handle */}
            <ResizableHandle className="bg-[hsl(var(--border))] hover:bg-[hsl(var(--color-accent)/0.3)] transition-all duration-[var(--transition-fast)] w-px" />
          </>
        )}
        
        {/* Chart Area - 右側 */}
        <ResizablePanel defaultSize={children ? 75 : 100} minSize={60}>
          <div className="h-full flex flex-col">
            {/* Chart Toolbar - チャートエリア内に配置 */}
            <ChartToolbar onFitContent={handleFitContent} />
            
            {/* Charts */}
            <ResizablePanelGroup direction="vertical" className="h-full">
              {/* Main Chart */}
              <ResizablePanel defaultSize={60} minSize={40}>
                {chartComponent}
              </ResizablePanel>
              
              {/* RSI Panel */}
              {indicators.rsi && (
                <>
                  <ResizableHandle className="bg-[hsl(var(--border))] hover:bg-[hsl(var(--color-accent)/0.3)] transition-all duration-[var(--transition-fast)] h-px" />
                  <ResizablePanel defaultSize={20} minSize={10} maxSize={40}>
                    <div className="h-full overflow-hidden premium-glass-subtle">
                      <IndicatorPanel 
                        title="RSI (14)" 
                        height="auto"
                        className="h-full"
                      >
                        <RsiChart />
                      </IndicatorPanel>
                    </div>
                  </ResizablePanel>
                </>
              )}
              
              {/* MACD Panel */}
              {indicators.macd && (
                <>
                  <ResizableHandle className="bg-[hsl(var(--border))] hover:bg-[hsl(var(--color-accent)/0.3)] transition-all duration-[var(--transition-fast)] h-px" />
                  <ResizablePanel defaultSize={20} minSize={10} maxSize={40}>
                    <div className="h-full overflow-hidden premium-glass-subtle">
                      <IndicatorPanel 
                        title="MACD (12, 26, 9)" 
                        height="auto"
                        className="h-full"
                      >
                        <MacdChart />
                      </IndicatorPanel>
                    </div>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}