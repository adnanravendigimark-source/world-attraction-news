export default function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto max-w-content px-3.5 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}
