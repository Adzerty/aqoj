// Petites icônes SVG « faites main » — trait propre, look soigné plutôt qu'emoji.
// Toutes héritent de `currentColor` et d'une taille via la prop `size`.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, strokeWidth = 1.75, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

/** Marque AQOJ : un dé arrondi avec quelques points. */
export function DiceMark({ size = 22, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="currentColor" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="var(--primary-fg)" />
      <circle cx="15.5" cy="8.5" r="1.5" fill="var(--primary-fg)" />
      <circle cx="12" cy="12" r="1.5" fill="var(--primary-fg)" />
      <circle cx="8.5" cy="15.5" r="1.5" fill="var(--primary-fg)" />
      <circle cx="15.5" cy="15.5" r="1.5" fill="var(--primary-fg)" />
    </svg>
  );
}

export function Sun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function Moon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function Users(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 19v-1a4 4 0 0 0-3-3.85M16 4.15A4 4 0 0 1 16 11.7" />
    </svg>
  );
}

export function Clock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function Sparkle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l1.8 5.4L19 10.2l-5.2 1.8L12 17.4l-1.8-5.4L5 10.2l5.2-1.8z" />
    </svg>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Shuffle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 4l3 3-3 3M18 14l3 3-3 3M3 7h4l9 10h5M21 7h-5l-2.5 2.8M3 17h4l2.5-2.8" />
    </svg>
  );
}

export function Grip(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={0} fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

export function ChevronUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function Lock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function Globe(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}

export function Discord({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.27 5.33A16.2 16.2 0 0 0 15.4 4.1a.06.06 0 0 0-.06.03c-.17.3-.36.7-.49 1a15 15 0 0 0-4.5 0c-.13-.31-.32-.7-.5-1a.06.06 0 0 0-.05-.03 16.2 16.2 0 0 0-3.88 1.23.05.05 0 0 0-.02.02C2.95 9.05 2.3 12.66 2.62 16.22a.07.07 0 0 0 .02.05 16.3 16.3 0 0 0 4.9 2.48.06.06 0 0 0 .07-.02c.38-.52.71-1.06.99-1.63a.06.06 0 0 0-.03-.08 10.7 10.7 0 0 1-1.53-.73.06.06 0 0 1 0-.1l.3-.24a.06.06 0 0 1 .06 0 11.6 11.6 0 0 0 9.86 0 .06.06 0 0 1 .06 0l.3.24a.06.06 0 0 1 0 .1c-.49.29-1 .54-1.53.73a.06.06 0 0 0-.03.08c.29.57.62 1.11.99 1.63a.06.06 0 0 0 .07.02 16.2 16.2 0 0 0 4.9-2.48.06.06 0 0 0 .03-.05c.38-4.12-.64-7.7-2.71-10.87a.05.05 0 0 0-.02-.02zM8.52 14.06c-.95 0-1.74-.88-1.74-1.95 0-1.08.77-1.96 1.74-1.96.98 0 1.76.89 1.74 1.96 0 1.07-.77 1.95-1.74 1.95zm6.97 0c-.95 0-1.73-.88-1.73-1.95 0-1.08.76-1.96 1.73-1.96.98 0 1.76.89 1.74 1.96 0 1.07-.76 1.95-1.74 1.95z" />
    </svg>
  );
}
