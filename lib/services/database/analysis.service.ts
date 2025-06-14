import { prisma } from '@/lib/db/prisma'
import type { AnalysisRecord, TouchEvent } from '@prisma/client'
import type { DrawingProposal, EntryProposal } from '@/types/proposals'

export class AnalysisService {
  /**
   * 分析記録を保存
   */
  static async saveAnalysis(data: {
    sessionId?: string
    symbol: string
    interval: string
    type: 'support' | 'resistance' | 'trendline' | 'pattern' | 'fibonacci'
    proposalData: DrawingProposal | EntryProposal | {
      id: string
      type: string
      confidence: number
      reasoning: string
      coordinates?: {
        start: { x: number; y: number }
        end: { x: number; y: number }
      }
      price?: number
      metadata?: Record<string, unknown>
    }
  }) {
    return await prisma.analysisRecord.create({
      data: {
        sessionId: data.sessionId,
        timestamp: BigInt(Date.now()),
        symbol: data.symbol,
        interval: data.interval,
        type: data.type,
        proposalData: data.proposalData,
        trackingData: {
          status: 'monitoring',
          touches: 0,
          startTime: Date.now()
        }
      }
    })
  }

  /**
   * タッチイベントを記録
   */
  static async recordTouchEvent(data: {
    recordId: string
    price: number
    result: 'bounce' | 'break' | 'test'
    strength: number
    volume?: number
  }) {
    // タッチイベントを保存
    const touchEvent = await prisma.touchEvent.create({
      data: {
        recordId: data.recordId,
        timestamp: BigInt(Date.now()),
        price: data.price,
        result: data.result,
        strength: data.strength,
        volume: data.volume
      }
    })

    // 分析記録のタッチ数を更新
    await prisma.analysisRecord.update({
      where: { id: data.recordId },
      data: {
        trackingData: {
          update: {
            touches: { increment: 1 },
            lastTouchTime: Date.now()
          }
        }
      }
    })

    return touchEvent
  }

  /**
   * セッションの分析記録を取得
   */
  static async getSessionAnalyses(sessionId: string) {
    return await prisma.analysisRecord.findMany({
      where: { sessionId },
      include: {
        touchEvents: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * アクティブな分析を取得
   */
  static async getActiveAnalyses(symbol?: string) {
    return await prisma.analysisRecord.findMany({
      where: {
        symbol: symbol,
        trackingData: {
          path: ['status'],
          equals: 'monitoring'
        }
      },
      include: {
        touchEvents: true
      }
    })
  }
}