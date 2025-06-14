/**
 * JSCodeshift transformation for migrating process.env usage to @/config/env
 * 
 * This codemod transforms direct process.env usage to type-safe environment access
 * from the centralized configuration module.
 * 
 * Usage:
 *   npx jscodeshift -t tools/codemods/env-migration.js --dry --print src/
 *   npx jscodeshift -t tools/codemods/env-migration.js src/
 * 
 * Transformations:
 * 1. Replaces process.env.VARIABLE_NAME with env.VARIABLE_NAME
 * 2. Adds import { env } from '@/config/env' if not already present
 * 3. Handles various patterns of process.env usage
 * 4. Preserves comments and code structure
 */

const IMPORT_SOURCE = '@/config/env';
const IMPORT_SPECIFIER = 'env';

// Environment variables that should be migrated
const ENV_VARIABLES = new Set([
  'NODE_ENV',
  'OPENAI_API_KEY', 
  'FORCE_VALIDATION',
  'LOG_LEVEL',
  'LOG_TRANSPORT',
  'DISABLE_CONSOLE_LOGS',
  'ENABLE_SENTRY',
  'ALLOWED_ORIGINS',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'NEXT_PUBLIC_BASE_URL',
  'VERCEL_URL',
  'USE_NEW_WS_MANAGER',
  'PORT'
]);

module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const source = j(fileInfo.source);
  let hasChanges = false;
  let needsImport = false;

  // Skip test files and config files themselves
  if (fileInfo.path.includes('__tests__') || 
      fileInfo.path.includes('.test.') ||
      fileInfo.path.includes('jest.setup.js') ||
      fileInfo.path.includes('config/env.ts') ||
      fileInfo.path.includes('env-validate.ts')) {
    return null;
  }

  // Find all process.env.VARIABLE usage
  source.find(j.MemberExpression, {
    object: {
      type: 'MemberExpression',
      object: { name: 'process' },
      property: { name: 'env' }
    }
  }).forEach(path => {
    const variableName = path.value.property.name;
    
    // Only migrate known environment variables
    if (ENV_VARIABLES.has(variableName)) {
      // Replace process.env.VARIABLE with env.VARIABLE
      j(path).replaceWith(
        j.memberExpression(
          j.identifier(IMPORT_SPECIFIER),
          j.identifier(variableName)
        )
      );
      
      hasChanges = true;
      needsImport = true;
      
      console.log(`[${fileInfo.path}] Migrated: process.env.${variableName} -> env.${variableName}`);
    }
  });

  // Find process.env['VARIABLE'] usage (bracket notation)
  source.find(j.MemberExpression, {
    object: {
      type: 'MemberExpression', 
      object: { name: 'process' },
      property: { name: 'env' }
    },
    computed: true
  }).forEach(path => {
    const property = path.value.property;
    let variableName;
    
    // Handle string literals
    if (property.type === 'Literal' && typeof property.value === 'string') {
      variableName = property.value;
    }
    
    if (variableName && ENV_VARIABLES.has(variableName)) {
      // Replace process.env['VARIABLE'] with env.VARIABLE
      j(path).replaceWith(
        j.memberExpression(
          j.identifier(IMPORT_SPECIFIER),
          j.identifier(variableName)
        )
      );
      
      hasChanges = true;
      needsImport = true;
      
      console.log(`[${fileInfo.path}] Migrated: process.env['${variableName}'] -> env.${variableName}`);
    }
  });

  // Add import if needed and not already present
  if (needsImport) {
    const hasExistingImport = source.find(j.ImportDeclaration, {
      source: { value: IMPORT_SOURCE }
    }).length > 0;

    if (!hasExistingImport) {
      // Find the first import declaration to insert after
      const firstImport = source.find(j.ImportDeclaration).at(0);
      
      const envImport = j.importDeclaration(
        [j.importSpecifier(j.identifier(IMPORT_SPECIFIER))],
        j.literal(IMPORT_SOURCE)
      );

      if (firstImport.length > 0) {
        // Insert after the first import
        firstImport.insertAfter(envImport);
      } else {
        // Insert at the beginning if no imports exist
        source.find(j.Program).get('body').get(0).insertBefore(envImport);
      }

      console.log(`[${fileInfo.path}] Added import: import { env } from '${IMPORT_SOURCE}'`);
    }
  }

  return hasChanges ? source.toSource({
    quote: 'single',
    reuseParsers: true,
  }) : null;
};

module.exports.parser = 'tsx';