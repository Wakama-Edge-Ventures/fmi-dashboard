interface PageLoaderProps {
  message?: string;
}

export default function PageLoader({ message = "Chargement…" }: PageLoaderProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-text-secondary">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}
