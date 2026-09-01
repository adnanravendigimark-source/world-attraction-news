export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="6" fill="#151310" />
      <path d="M8 28L15 12L22 28" stroke="#fbf9f5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 22H19" stroke="#fbf9f5" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="29" cy="18" r="5" stroke="#b3122a" strokeWidth="2.4" />
    </svg>
  );
}
