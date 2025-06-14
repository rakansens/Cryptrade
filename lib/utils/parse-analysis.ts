import type { AnalysisResultData } from '@/components/chat/AnalysisResultCard'

/**
 * Parse analysis text into structured data
 * AIからのテキスト分析結果を構造化データに変換
 */
export function parseAnalysisText(text: string): AnalysisResultData | null {
  try {
    // Extract symbol and timeframe from the first line
    const symbolMatch = text.match(/^(.+?)の(\d+[分時間日週月]+).*チャート/m)
    if (!symbolMatch) return null

    const symbol = symbolMatch[1]
    const timeframe = symbolMatch[2]

    // Extract current price
    const priceMatch = text.match(/(?:現在値|現値|現在価格|価格)[:\s]*\$?\s*([\d,]+\.?\d*)/i)
    const currentPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0

    // Extract trend information
    const trendMatch = text.match(/トレンド方向[:\s]*(.+?)(?:\s|$)/)
    const trendStrengthMatch = text.match(/トレンド強度[:\s]*(\d+)%/)
    const trendConfidenceMatch = text.match(/信頼度[:\s]*(\d+)%/)
    
    const trendDirection = trendMatch?.[1]?.includes('上昇') ? 'up' : 
                          trendMatch?.[1]?.includes('下降') ? 'down' : 
                          (trendMatch?.[1]?.includes('横ばい') || trendMatch?.[1]?.includes('レンジ')) ? 'neutral' : 'neutral'

    // Extract support and resistance levels
    const supportMatches = text.matchAll(/サポートライン[:\s]*\$?([\d,]+\.?\d*)\s*\(強度:\s*(\d+)%.*?タッチ回数:\s*(\d+)/g)
    const resistanceMatches = text.matchAll(/レジスタンスライン[:\s]*\$?([\d,]+\.?\d*)\s*\(強度:\s*(\d+)%.*?タッチ回数:\s*(\d+)/g)

    const support = Array.from(supportMatches).map(match => ({
      price: parseFloat(match[1].replace(/,/g, '')),
      strength: parseInt(match[2]),
      touches: parseInt(match[3])
    }))

    const resistance = Array.from(resistanceMatches).map(match => ({
      price: parseFloat(match[1].replace(/,/g, '')),
      strength: parseInt(match[2]),
      touches: parseInt(match[3])
    }))

    // Extract volatility
    const atrMatch = text.match(/ATR[:\s]*([\d.]+)/)
    const volatilityLevelMatch = text.match(/ボラティリティレベル[:\s]*(.+?)(?:\s|$)/)
    const atrPercentMatch = text.match(/ATR[パーセント%]+[:\s]*([\d.]+)%/)

    const volatilityLevel = volatilityLevelMatch?.[1]?.includes('高') ? 'high' :
                           volatilityLevelMatch?.[1]?.includes('低') ? 'low' : 
                           volatilityLevelMatch?.[1]?.includes('中') ? 'medium' : 'medium'

    // Extract momentum indicators
    const rsiMatch = text.match(/RSI[:\s]*([\d.]+)/)
    const rsiSignalMatch = text.match(/RSI[:\s]*[\d.]+\s*\((.+?)\)/)
    const macdTrendMatch = text.match(/MACD[:\s]*(.+?)シグナル/)

    const rsiSignal = rsiSignalMatch?.[1]?.includes('買われ過ぎ') ? 'overbought' :
                     rsiSignalMatch?.[1]?.includes('売られ過ぎ') ? 'oversold' : 'neutral'

    const macdTrend = macdTrendMatch?.[1]?.includes('強気') ? 'bullish' :
                     macdTrendMatch?.[1]?.includes('弱気') ? 'bearish' : 'neutral'

    // Extract patterns
    const patternSection = text.match(/検出されたパターン[:\s]*([\s\S]*?)(?=###|推奨事項|$)/);
    const patterns: Array<{name: string, description: string}> = [];
    
    if (patternSection) {
      const patternLines = patternSection[1].split('\n').filter(line => line.trim());
      patternLines.forEach(line => {
        const match = line.match(/(.+?)[：:]\s*(.+)/);
        if (match) {
          patterns.push({
            name: match[1].trim(),
            description: match[2].trim()
          });
        }
      });
    }

    // Extract recommendations
    const recommendationSection = text.match(/推奨事項[:\s]*([\s\S]*?)(?=###|次のアクション|$)/s)
    const recommendations: string[] = []
    
    if (recommendationSection) {
      const lines = recommendationSection[1].split('\n')
      lines.forEach(line => {
        // Handle various bullet formats: -, *, ・, or plain text
        const cleaned = line.trim().replace(/^[-\*・]\s*/, '')
        if (cleaned && cleaned.length > 0) {
          recommendations.push(cleaned)
        }
      })
    }

    // Extract next actions
    const nextActionsMatch = text.match(/次のアクション[:\s]*(.+?)(?=$)/s)
    const nextActions = nextActionsMatch?.[1]
      ?.split(/[。\n]/)
      ?.filter(a => a.trim())
      ?.map(a => a.trim())
      ?.filter(a => a.length > 0) || []

    return {
      symbol,
      timeframe,
      price: {
        current: currentPrice
      },
      trend: {
        direction: trendDirection,
        strength: parseInt(trendStrengthMatch?.[1] || '0'),
        confidence: parseInt(trendConfidenceMatch?.[1] || '0')
      },
      support,
      resistance,
      volatility: {
        atr: parseFloat(atrMatch?.[1] || '0'),
        level: volatilityLevel,
        percentage: parseFloat(atrPercentMatch?.[1] || '0')
      },
      momentum: {
        rsi: {
          value: parseFloat(rsiMatch?.[1] || '0'),
          signal: rsiSignal
        },
        macd: {
          value: 0, // These values would need more complex parsing
          signal: 0,
          histogram: 0,
          trend: macdTrend
        }
      },
      patterns: patterns.length > 0 ? patterns : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      nextActions: nextActions.length > 0 ? nextActions : undefined
    }
  } catch (error) {
    console.error('Failed to parse analysis text:', error)
    return null
  }
}

/**
 * Check if a message contains analysis results
 * メッセージが分析結果を含むかチェック
 */
export function isAnalysisMessage(content: string): boolean {
  // Look for key indicators that this is an analysis result
  const indicators = [
    /の\d+[分時間日週月]+.*チャート.*分析結果/,
    /の\d+[分時間日週月]+足?チャート.*分析結果/,
    /現在の?価格.*トレンド分析/s,
    /サポートとレジスタンス/,
    /ボラティリティ.*モメンタム指標/s
  ]
  
  return indicators.some(pattern => pattern.test(content))
}