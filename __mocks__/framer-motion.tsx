import React from 'react';

// Motion component mock
export const motion = new Proxy(
  {},
  {
    get: (target, prop) => {
      // Return a component that strips motion props and renders the element
      return React.forwardRef((props: any, ref: any) => {
        const { 
          initial, 
          animate, 
          exit, 
          transition,
          variants,
          whileHover,
          whileTap,
          whileDrag,
          whileFocus,
          whileInView,
          drag,
          dragConstraints,
          dragElastic,
          dragMomentum,
          dragTransition,
          dragPropagation,
          onDragStart,
          onDrag,
          onDragEnd,
          onDirectionLock,
          layout,
          layoutId,
          style,
          ...rest 
        } = props;

        // Convert motion values to regular values
        const finalStyle = style ? Object.entries(style).reduce((acc, [key, value]) => {
          acc[key] = typeof value === 'object' && value.get ? value.get() : value;
          return acc;
        }, {} as any) : undefined;

        return React.createElement(prop as string, { 
          ...rest, 
          style: finalStyle,
          ref 
        });
      });
    }
  }
);

// AnimatePresence mock
export const AnimatePresence = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// Animation controls mock
export const useAnimation = () => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    set: jest.fn(),
  };
};

// Motion values
export class MotionValue {
  private current: any;
  
  constructor(init: any) {
    this.current = init;
  }
  
  get() {
    return this.current;
  }
  
  set(v: any) {
    this.current = v;
  }
  
  subscribe(callback: (v: any) => void) {
    return () => {};
  }
}

export const useMotionValue = (init: any) => new MotionValue(init);

// Transform
export const useTransform = (value: MotionValue, inputRange: number[], outputRange: any[]) => {
  return new MotionValue(outputRange[0]);
};

// Spring
export const useSpring = (value: MotionValue, config = {}) => value;

// Scroll
export const useScroll = () => ({
  scrollX: new MotionValue(0),
  scrollY: new MotionValue(0),
  scrollXProgress: new MotionValue(0),
  scrollYProgress: new MotionValue(0),
});

// Variants
export const useAnimationControls = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  set: jest.fn(),
});

// In view
export const useInView = (ref: any, options = {}) => {
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    setInView(true);
  }, []);
  return inView;
};

// Reduced motion
export const useReducedMotion = () => false;

// Cycle
export const useCycle = (...states: any[]) => {
  const [index, setIndex] = React.useState(0);
  const cycle = () => setIndex((i) => (i + 1) % states.length);
  return [states[index], cycle];
};

// Drag controls
export const useDragControls = () => ({
  start: jest.fn(),
  stop: jest.fn(),
});

// Focus
export const useFocusWithin = () => {
  const [isFocusWithin, setIsFocusWithin] = React.useState(false);
  return isFocusWithin;
};