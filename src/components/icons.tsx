const PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  filter: <path d="M3 4h18l-7 8v6l-4 2v-8z" />,
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11M15 9v11" />
    </>
  ),
  caret: <path d="M6 9l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pen: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  move: (
    <>
      <path d="M5 4v9a3 3 0 003 3h11" />
      <path d="M15 12l4 4-4 4" />
    </>
  ),
  bin: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  eye: (
    <>
      <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  hidden: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.8 9.8 0 0112 6c5 0 9 6 9 6a16 16 0 01-3.2 3.7M6.6 6.6C4.1 8.2 3 12 3 12s4 6 9 6a8.6 8.6 0 004.4-1.2" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

/** Line icon; decorative unless given a label. */
export function Icon({
  name,
  size = 14,
  weight = 2,
  label,
  className,
}: {
  name: IconName;
  size?: number;
  weight?: number;
  label?: string;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: labelled icons get role="img" and aria-label; the rest are aria-hidden
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {PATHS[name]}
    </svg>
  );
}
