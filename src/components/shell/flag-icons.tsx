/**
 * Two flags, drawn rather than typed.
 *
 * The obvious move is the emoji — 🇵🇭 and 🇺🇸 — and it is the wrong one:
 * Windows has no flag glyphs at all and renders a regional-indicator pair as
 * two boxed letters, so on the machine most of this is built and tested on the
 * "flag" button would read "PH". These are a few shapes each and they render
 * the same everywhere.
 *
 * Both use the same 20x14 box so the toggle does not change width when the
 * language changes. That is a liberty — the Philippine flag is 1:2 and the
 * American 10:19 — and it is the right one at 20 pixels wide.
 */

export function PhilippinesFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 14"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="20" height="7" fill="#0038A8" />
      <rect y="7" width="20" height="7" fill="#CE1126" />
      <path d="M0 0 L8.5 7 L0 14 Z" fill="#FFFFFF" />
      <circle cx="2.9" cy="7" r="1.45" fill="#FCD116" />
      <circle cx="1" cy="1.7" r="0.6" fill="#FCD116" />
      <circle cx="1" cy="12.3" r="0.6" fill="#FCD116" />
      <circle cx="6.6" cy="7" r="0.6" fill="#FCD116" />
    </svg>
  )
}

export function UnitedStatesFlag({ className }: { className?: string }) {
  // Seven red stripes on white, then the canton over the top four.
  const stripes = [0, 2, 4, 6, 8, 10, 12]
  return (
    <svg
      viewBox="0 0 20 14"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="20" height="14" fill="#FFFFFF" />
      {stripes.map((y) => (
        <rect key={y} y={y} width="20" height="1" fill="#B22234" />
      ))}
      <rect width="8.5" height="7" fill="#3C3B6E" />
      {[1.4, 4.2, 7].map((cy) =>
        [1.4, 3.4, 5.4, 7.4].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.45" fill="#FFFFFF" />
        ))
      )}
    </svg>
  )
}
