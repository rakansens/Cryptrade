#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { ChatDatabaseService } from '@/lib/services/database/chat.service'
import { ChartDrawingDatabaseService } from '@/lib/services/database/chart-drawing.service'
import { AnalysisService } from '@/lib/services/database/analysis.service'
import { logger } from '@/lib/utils/logger'

async function migrateChat(path: string) {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  if (data.sessions && data.messagesBySession) {
    await ChatDatabaseService.migrateFromLocalStorage({
      sessions: data.sessions,
      messagesBySession: data.messagesBySession,
    })
  }
}

async function migrateChart(path: string) {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  await ChartDrawingDatabaseService.migrateFromLocalStorage(
    data.drawings || [],
    data.patterns || [],
    data.sessionId
  )
}

async function migrateAnalysis(path: string) {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  if (Array.isArray(data.records)) {
    for (const record of data.records) {
      await AnalysisService.saveAnalysis(record as any)
    }
  }
}

async function main() {
  const [chatFile, chartFile, analysisFile] = process.argv.slice(2)
  if (!chatFile && !chartFile && !analysisFile) {
    console.error('Usage: tsx scripts/migrate-to-supabase.ts <chat.json> <chart.json> <analysis.json>')
    process.exit(1)
  }
  try {
    if (chatFile) await migrateChat(chatFile)
    if (chartFile) await migrateChart(chartFile)
    if (analysisFile) await migrateAnalysis(analysisFile)
    logger.info('[Migration] Completed successfully')
  } catch (err) {
    logger.error('[Migration] Failed', { err })
    process.exit(1)
  }
}

main()

