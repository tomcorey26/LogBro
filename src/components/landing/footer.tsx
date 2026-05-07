import { APP_NAME } from "@/data/app";

export function LandingFooter() {
  return (
    <footer className="py-8 text-center text-sm text-muted-foreground">
      <p>{new Date().getFullYear()} {APP_NAME}</p>
    </footer>
  );
}
