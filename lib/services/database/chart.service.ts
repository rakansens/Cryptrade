import { prisma } from '@/lib/db/prisma'
import type { DrawingType } from '@prisma/client'
import type { ChartDrawing } from '@/lib/validation/chart-drawing.schema'

export class ChartService {
  static async saveDrawing(sessionId: string, drawing: ChartDrawing) {
    return prisma.chartDrawing.create({
      data: {
        sessionId,
        type: drawing.type as DrawingType,
        points: drawing.points,
        style: drawing.style as any,
        visible: drawing.visible,
      },
    })
  }

  static async getDrawings(sessionId: string) {
    return prisma.chartDrawing.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    })
  }
}

