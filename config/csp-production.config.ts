/**
 * Production CSP Configuration
 * 
 * This file contains the production-specific CSP configuration
 * Used to override default CSP settings for production environment
 */

export interface CSPProductionConfig {
  allowedDomains: {
    scripts: string[];
    styles: string[];
    fonts: string[];
    images: string[];
    connect: string[];
    media: string[];
    frame: string[];
  };
  reportingEndpoint?: string;
  upgradeInsecureRequests: boolean;
  blockAllMixedContent: boolean;
}

export const CSP_PRODUCTION_CONFIG: CSPProductionConfig = {
  allowedDomains: {
    scripts: [
      // Analytics and monitoring
      'https://*.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://*.sentry.io',
      'https://*.sentry-cdn.com',
      
      // Vercel Analytics
      'https://vercel.live',
      'https://vercel.com',
      
      // Other required scripts
      'https://cdn.jsdelivr.net', // For libraries if needed
    ],
    
    styles: [
      // Google Fonts
      'https://fonts.googleapis.com',
      
      // Icon libraries if used
      'https://cdnjs.cloudflare.com',
    ],
    
    fonts: [
      // Google Fonts
      'https://fonts.gstatic.com',
    ],
    
    images: [
      // CDN domains
      'https://*.vercel.app',
      'https://*.vercel.sh',
      
      // Image optimization services
      'https://res.cloudinary.com', // If using Cloudinary
      
      // Crypto logos/icons
      'https://cryptologos.cc',
      'https://s2.coinmarketcap.com',
    ],
    
    connect: [
      // API endpoints
      'https://api.binance.com',
      'https://stream.binance.com',
      'wss://stream.binance.com:443',
      'wss://stream.binance.com:9443',
      
      // Supabase
      'https://*.supabase.co',
      'wss://*.supabase.co',
      
      // Analytics and monitoring
      'https://*.google-analytics.com',
      'https://www.google-analytics.com',
      'https://*.sentry.io',
      'https://*.ingest.sentry.io',
      
      // Vercel Analytics
      'https://vitals.vercel-insights.com',
      'https://*.vercel-insights.com',
      
      // Error tracking
      'https://o4504032951607296.ingest.sentry.io',
    ],
    
    media: [
      // Add any media CDNs if needed
    ],
    
    frame: [
      // Add any iframe sources if needed
      // Keep empty for maximum security
    ],
  },
  
  // CSP violation reporting endpoint
  reportingEndpoint: process.env['CSP_REPORT_URI'] || '/api/csp-report',
  
  // Security settings
  upgradeInsecureRequests: true,
  blockAllMixedContent: true,
};

/**
 * Get CSP directives for production
 */
export function getProductionCSPDirectives(): Record<string, string[]> {
  const config = CSP_PRODUCTION_CONFIG;
  
  return {
    // Script sources
    'script-src': [
      "'self'",
      "'nonce-{{nonce}}'",
      "'strict-dynamic'",
      ...config.allowedDomains.scripts,
    ],
    
    // Style sources
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Next.js styled-jsx
      ...config.allowedDomains.styles,
    ],
    
    // Font sources
    'font-src': [
      "'self'",
      ...config.allowedDomains.fonts,
    ],
    
    // Image sources
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      ...config.allowedDomains.images,
    ],
    
    // Connection sources
    'connect-src': [
      "'self'",
      ...config.allowedDomains.connect,
    ],
    
    // Media sources
    'media-src': [
      "'self'",
      ...config.allowedDomains.media,
    ],
    
    // Frame sources
    'frame-src': [
      "'none'", // No iframes allowed by default
      ...config.allowedDomains.frame,
    ],
    
    // Other directives
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    
    // Reporting
    ...(config.reportingEndpoint ? {
      'report-uri': [config.reportingEndpoint],
      'report-to': ['csp-endpoint'],
    } : {}),
    
    // Security upgrades
    ...(config.upgradeInsecureRequests ? {
      'upgrade-insecure-requests': [],
    } : {}),
    
    ...(config.blockAllMixedContent ? {
      'block-all-mixed-content': [],
    } : {}),
  };
}

/**
 * Validate production configuration
 */
export function validateProductionConfig(): string[] {
  const errors: string[] = [];
  const config = CSP_PRODUCTION_CONFIG;
  
  // Check for development URLs
  const allDomains = Object.values(config.allowedDomains).flat();
  const devPatterns = ['localhost', 'http://', '127.0.0.1', '.local'];
  
  allDomains.forEach(domain => {
    devPatterns.forEach(pattern => {
      if (domain.includes(pattern)) {
        errors.push(`Development URL pattern "${pattern}" found in domain: ${domain}`);
      }
    });
  });
  
  // Ensure HTTPS for all domains
  allDomains.forEach(domain => {
    if (domain.startsWith('http://')) {
      errors.push(`Insecure HTTP domain found: ${domain}`);
    }
  });
  
  return errors;
}