module.exports = {
  rules: {
    // Custom rule to ensure drawing operations use the store
    'no-direct-drawing-manipulation': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Ensure all drawing operations go through the chart store',
          recommended: true
        }
      },
      create(context) {
        return {
          CallExpression(node) {
            const callee = node.callee;
            
            // Check for direct drawing manager calls that should use store
            if (callee.type === 'MemberExpression') {
              const object = callee.object;
              const property = callee.property;
              
              if (object.name === 'drawingManager' && 
                  ['addTrendline', 'addHorizontalLine', 'addVerticalLine', 'addFibonacci'].includes(property.name)) {
                context.report({
                  node,
                  message: 'Use chart store methods (addDrawing) instead of direct drawing manager calls to ensure persistence'
                });
              }
            }
          }
        };
      }
    },
    
    // Ensure validateDrawing is used before adding drawings
    'validate-before-persist': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Validate drawings before persisting to storage',
          recommended: true
        }
      },
      create(context) {
        return {
          CallExpression(node) {
            if (node.callee.type === 'MemberExpression' &&
                node.callee.property.name === 'setItem' &&
                node.arguments[0]?.value?.includes('drawing')) {
              
              // Check if validateDrawing was called in the same function
              const functionScope = context.getScope().variableScope;
              const hasValidation = functionScope.references.some(ref => 
                ref.identifier.name === 'validateDrawing'
              );
              
              if (!hasValidation) {
                context.report({
                  node,
                  message: 'Always validate drawings with validateDrawing() before saving to localStorage'
                });
              }
            }
          }
        };
      }
    }
  }
};