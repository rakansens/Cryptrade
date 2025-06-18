import { cn } from '@/lib/utils';

describe('utils', () => {
  describe('cn function', () => {
    it('should combine class names', () => {
      const result = cn('class1', 'class2', 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const isDisabled = false;
      
      const result = cn(
        'base-class',
        isActive && 'active-class',
        isDisabled && 'disabled-class'
      );
      
      expect(result).toBe('base-class active-class');
    });

    it('should handle object syntax', () => {
      const result = cn({
        'base-class': true,
        'active-class': true,
        'disabled-class': false,
      });
      
      expect(result).toBe('base-class active-class');
    });

    it('should handle array of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should merge tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4', 'py-2');
      expect(result).toBe('px-4 py-2');
    });

    it('should handle conflicting tailwind classes', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should handle complex tailwind modifiers', () => {
      const result = cn(
        'hover:bg-gray-100 dark:bg-gray-800',
        'hover:bg-blue-100'
      );
      expect(result).toBe('dark:bg-gray-800 hover:bg-blue-100');
    });

    it('should handle empty inputs', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle null and undefined values', () => {
      const result = cn('class1', null, undefined, 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle falsy values', () => {
      const result = cn('class1', false, 0, '', 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle nested arrays', () => {
      const result = cn(['class1', ['class2', 'class3']], 'class4');
      expect(result).toBe('class1 class2 class3 class4');
    });

    it('should handle mixed input types', () => {
      const result = cn(
        'string-class',
        ['array-class'],
        {
          'object-true': true,
          'object-false': false,
        },
        undefined,
        null
      );
      expect(result).toBe('string-class array-class object-true');
    });

    it('should preserve important modifiers', () => {
      const result = cn('!text-red-500', 'text-blue-500');
      expect(result).toBe('!text-red-500 text-blue-500');
    });

    it('should handle responsive breakpoints', () => {
      const result = cn('md:px-4 lg:px-6', 'md:px-8');
      expect(result).toBe('lg:px-6 md:px-8');
    });

    it('should handle arbitrary values', () => {
      const result = cn('w-[100px]', 'w-[200px]');
      expect(result).toBe('w-[200px]');
    });

    it('should handle multiple arbitrary properties', () => {
      const result = cn('[mask-type:luminance]', '[mask-size:cover]');
      expect(result).toBe('[mask-type:luminance] [mask-size:cover]');
    });

    it('should handle duplicate classes', () => {
      const result = cn('class1', 'class1', 'class2', 'class2');
      // tailwind-merge doesn't deduplicate non-tailwind classes
      expect(result).toBe('class1 class1 class2 class2');
    });

    it('should handle template literal inputs', () => {
      const baseClass = 'base';
      const modifier = 'modifier';
      const result = cn(`${baseClass}-class`, `${modifier}-class`);
      expect(result).toBe('base-class modifier-class');
    });

    it('should handle deeply nested conditional logic', () => {
      const condition1 = true;
      const condition2 = false;
      const condition3 = true;
      
      const result = cn(
        'base',
        condition1 && [
          'level1',
          condition2 && 'level2-false',
          condition3 && 'level2-true'
        ]
      );
      
      expect(result).toBe('base level1 level2-true');
    });

    it('should handle large number of classes', () => {
      const classes = Array.from({ length: 100 }, (_, i) => `class-${i}`);
      const result = cn(...classes);
      
      expect(result.split(' ').length).toBe(100);
      expect(result).toContain('class-0');
      expect(result).toContain('class-99');
    });

    it('should be pure function', () => {
      const input = ['class1', 'class2'];
      const result1 = cn(input);
      const result2 = cn(input);
      
      expect(result1).toBe(result2);
      expect(input).toEqual(['class1', 'class2']); // Input not mutated
    });

    it('should handle CSS module classes', () => {
      const styles = {
        container: 'styles_container__3Kx2s',
        active: 'styles_active__2mN9p',
      };
      
      const result = cn(styles.container, styles.active);
      expect(result).toBe('styles_container__3Kx2s styles_active__2mN9p');
    });

    it('should handle utility composition', () => {
      const buttonBase = 'px-4 py-2 rounded';
      const buttonPrimary = 'bg-blue-500 text-white';
      const buttonLarge = 'px-6 py-3 text-lg';
      
      const result = cn(buttonBase, buttonPrimary, buttonLarge);
      expect(result).toBe('rounded bg-blue-500 text-white px-6 py-3 text-lg');
    });

    it('should handle animation classes', () => {
      const result = cn('animate-spin', 'animate-bounce');
      expect(result).toBe('animate-bounce');
    });

    it('should handle transform classes', () => {
      const result = cn('rotate-45', 'scale-110', 'rotate-90');
      expect(result).toBe('scale-110 rotate-90');
    });

    it('should handle gradient classes', () => {
      const result = cn(
        'bg-gradient-to-r from-blue-500 to-purple-500',
        'from-green-500',
        'to-yellow-500'
      );
      expect(result).toBe('bg-gradient-to-r from-green-500 to-yellow-500');
    });

    it('should work with tailwind-merge edge cases', () => {
      // Test some known edge cases from tailwind-merge
      const result1 = cn('p-3 px-4');
      expect(result1).toBe('p-3 px-4');

      const result2 = cn('m-2', 'mx-4');
      expect(result2).toBe('m-2 mx-4');

      const result3 = cn('border', 'border-2');
      expect(result3).toBe('border-2');
    });

    it('should handle pseudo-class variants', () => {
      const result = cn(
        'hover:text-blue-500 focus:text-blue-500',
        'hover:text-green-500'
      );
      expect(result).toBe('focus:text-blue-500 hover:text-green-500');
    });

    it('should handle group and peer modifiers', () => {
      const result = cn(
        'group-hover:text-blue-500',
        'peer-checked:bg-blue-500',
        'group-hover:text-green-500'
      );
      expect(result).toBe('peer-checked:bg-blue-500 group-hover:text-green-500');
    });

    it('should handle state variants', () => {
      const result = cn(
        'disabled:opacity-50',
        'aria-selected:bg-blue-500',
        'data-[state=open]:bg-gray-100'
      );
      expect(result).toBe('disabled:opacity-50 aria-selected:bg-blue-500 data-[state=open]:bg-gray-100');
    });

    it('should handle negative values', () => {
      const result = cn('-mt-4', 'mt-2', '-mx-2');
      expect(result).toBe('mt-2 -mx-2');
    });

    it('should handle decimal values', () => {
      const result = cn('opacity-50', 'opacity-75', 'scale-125');
      expect(result).toBe('opacity-75 scale-125');
    });

    it('should handle colors with alpha values', () => {
      const result = cn('bg-black/50', 'bg-white/75');
      expect(result).toBe('bg-white/75');
    });

    it('should handle print modifier', () => {
      const result = cn('print:hidden', 'print:text-black');
      expect(result).toBe('print:hidden print:text-black');
    });

    it('should handle motion preferences', () => {
      const result = cn(
        'motion-safe:animate-spin',
        'motion-reduce:animate-none'
      );
      expect(result).toBe('motion-safe:animate-spin motion-reduce:animate-none');
    });

    it('should handle container queries', () => {
      const result = cn('@sm:p-4', '@md:p-6', '@lg:p-8');
      expect(result).toBe('@sm:p-4 @md:p-6 @lg:p-8');
    });

    it('should handle supports queries', () => {
      const result = cn(
        'supports-[display:grid]:grid',
        'supports-[display:flex]:flex'
      );
      expect(result).toBe('supports-[display:grid]:grid supports-[display:flex]:flex');
    });

    it('should be performant with large inputs', () => {
      const start = performance.now();
      const classes = Array.from({ length: 1000 }, (_, i) => `class-${i}`);
      cn(...classes);
      const end = performance.now();
      
      // Should complete in reasonable time (less than 100ms)
      expect(end - start).toBeLessThan(100);
    });
  });
});