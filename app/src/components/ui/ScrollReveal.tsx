'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  staggerChildren?: boolean;
  staggerDelay?: number;
}

export function ScrollReveal({
  children,
  className = '',
  staggerChildren = false,
  staggerDelay = 100,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );

    if (staggerChildren) {
      const children = el.querySelectorAll(':scope > *');
      children.forEach((child, i) => {
        (child as HTMLElement).style.transitionDelay = `${i * staggerDelay}ms`;
        child.classList.add('reveal');
        observer.observe(child);
      });
    } else {
      el.classList.add('reveal');
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [staggerChildren, staggerDelay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
