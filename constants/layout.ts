/**
 * Consistent spacing values for the application
 */
export const SPACING = {
  xs: 'space-y-1',
  sm: 'space-y-2',
  md: 'space-y-3',
  lg: 'space-y-4',
  xl: 'space-y-6'
} as const

/**
 * Consistent padding values
 */
export const PADDING = {
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
  xl: 'p-6'
} as const

/**
 * Consistent gap values for flex/grid
 */
export const GAP = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6'
} as const

/**
 * Common layout patterns
 */
export const LAYOUT_PATTERNS = {
  fullHeight: 'h-full flex flex-col overflow-hidden',
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexStart: 'flex items-start',
  flexEnd: 'flex items-end justify-end',
  gridAuto: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
} as const