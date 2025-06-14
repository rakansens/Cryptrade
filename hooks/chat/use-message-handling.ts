'use client'

import { useCallback, useState } from 'react'
import { useChat } from '@/store/chat.store'
import { useAIChat } from '@/hooks/use-ai-chat'
import { logger } from '@/lib/utils/logger'
import { useAsyncState } from '@/hooks/base/use-async-state'

export function useMessageHandling() {
  const { 
    inputValue, 
    setInputValue,
    isLoading,
  } = useChat()
  
  const { send: sendAIMessage, isReady } = useAIChat()
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [analysisInProgress, setAnalysisInProgress] = useState<{
    messageId: string;
    symbol: string;
    interval: string;
    analysisType: 'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all';
  } | null>(null)

  /**
   * メッセージ送信用の汎用 AsyncState
   * text と sessionId を引数に受け取り、useAIChat の send を実行
   */
  const {
    execute: executeSendMessage,
    loading: sendLoading,
  } = useAsyncState(async (text: string) => {
    // useAIChat 側で Error ハンドリング済みだが、念のため try-catch
    try {
      await sendAIMessage(text)
    } catch (e) {
      logger.error('[useMessageHandling] Failed to send message via execute', {
        error: String(e),
      })
      throw e
    }
  })

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading || sendLoading || !isReady) return

    const currentInput = inputValue.trim()
    
    // Clear input immediately for better UX
    setInputValue('', false)

    // Check if this is an analysis request
    const analysisKeywords = [
      'トレンドライン', 'trendline', 'trend line',
      'サポート', 'レジスタンス', 'support', 'resistance',
      'フィボナッチ', 'fibonacci', 'fib',
      'パターン', 'pattern',
      '分析', 'analysis', 'analyze',
      '提案', 'proposal', 'suggest',
      '描画', 'draw'
    ];
    
    const isAnalysisRequest = analysisKeywords.some(keyword => 
      currentInput.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isAnalysisRequest) {
      // Extract symbol and interval from the message or use defaults
      const symbolMatch = currentInput.match(/\b(BTC|ETH|BNB|SOL|ADA|XRP|DOT|DOGE|AVAX|MATIC|LINK|UNI)(?:USDT)?\b/i);
      const intervalMatch = currentInput.match(/\b(\d+[mhd]|1[wM])\b/);
      
      // Determine analysis type
      let analysisType: 'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all' = 'all';
      if (currentInput.toLowerCase().includes('トレンドライン') || currentInput.toLowerCase().includes('trendline')) {
        analysisType = 'trendline';
      } else if (currentInput.toLowerCase().includes('サポート') || currentInput.toLowerCase().includes('レジスタンス') || 
                 currentInput.toLowerCase().includes('support') || currentInput.toLowerCase().includes('resistance')) {
        analysisType = 'support-resistance';
      } else if (currentInput.toLowerCase().includes('フィボナッチ') || currentInput.toLowerCase().includes('fibonacci')) {
        analysisType = 'fibonacci';
      } else if (currentInput.toLowerCase().includes('パターン') || currentInput.toLowerCase().includes('pattern')) {
        analysisType = 'pattern';
      }
      
      const symbol = (symbolMatch?.[1] || 'BTC').toUpperCase() + 'USDT';
      const interval = intervalMatch?.[1] || '1h';
      
      logger.info('[ChatPanel] Detected analysis request', { 
        message: currentInput, 
        symbol, 
        interval,
        analysisType,
        isAnalysisRequest 
      });
      
      // Set analysis in progress
      setAnalysisInProgress({
        messageId: Date.now().toString(),
        symbol: symbol, // Keep the full symbol including USDT
        interval,
        analysisType
      });
    }

    await executeSendMessage(currentInput)
  }, [inputValue, isLoading, isReady, setInputValue, sendLoading, executeSendMessage])

  const handleCopyMessage = useCallback((messageId: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedMessageId(messageId)
    setTimeout(() => {
      setCopiedMessageId(null)
    }, 2000)
  }, [])

  const handleAnalysisComplete = useCallback((data: unknown) => {
    logger.info('[ChatPanel] Analysis completed', data);
    setAnalysisInProgress(null);
  }, [])

  return {
    handleSendMessage,
    handleCopyMessage,
    handleAnalysisComplete,
    copiedMessageId,
    analysisInProgress,
    setAnalysisInProgress
  }
}