import { useEffect, useState } from 'react';

const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 1024;

const measure = (): number => {
  if (typeof window === 'undefined') return 1;
  const { innerWidth: width, innerHeight: height } = window;
  return Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
};

const useFitScale = (): number => {
  const [scale, setScale] = useState<number>(measure);

  useEffect(() => {
    const onResize = () => setScale(measure());
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return scale;
};

export { DESIGN_WIDTH, DESIGN_HEIGHT };
export default useFitScale;
