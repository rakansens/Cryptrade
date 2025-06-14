'use client'

import { useMemo } from 'react'

export function useAnalysisFormatting() {
  return useMemo(() => ({
    formatDate: (timestamp: number) => {
      const date = new Date(timestamp)
      const now = new Date()
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
      
      if (diffInHours < 1) {
        return `${Math.round(diffInHours * 60)}分前`
      } else if (diffInHours < 24) {
        return `${Math.round(diffInHours)}時間前`
      } else if (diffInHours < 48) {
        return '昨日'
      } else {
        return date.toLocaleDateString('ja-JP', { 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric'
        })
      }
    },

    formatDuration: (milliseconds: number) => {
      const hours = Math.floor(milliseconds / (1000 * 60 * 60))
      const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))
      
      if (hours > 0) {
        return `${hours}時間${minutes > 0 ? minutes + '分' : ''}`
      } else if (minutes > 0) {
        return `${minutes}分`
      } else {
        return '1分未満'
      }
    },

    formatPercentage: (value: number) => {
      return `${Math.round(value * 100)}%`
    },

    formatPrice: (price: number) => {
      return `$${price.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`
    }
  }), [])
}