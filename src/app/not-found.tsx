import Link from "next/link";

export default function NotFound() {
  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-background px-4">
      <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-6">Page not found</p>
      <Link
        href="/routines"
        className="text-sm font-medium text-primary hover:underline"
      >
        Back to routines
      </Link>
    </div>
  );
}
