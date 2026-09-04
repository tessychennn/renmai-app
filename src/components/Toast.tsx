export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="glass pointer-events-none fixed inset-x-0 z-40 mx-auto w-fit max-w-[85%] rounded-full border-[0.5px] border-hairline px-5 py-2.5 text-sm font-medium shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 92px)' }}
    >
      {message}
    </div>
  );
}
