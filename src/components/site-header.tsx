import { Link } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link to="/" className="min-w-0 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className="truncate text-lg font-bold tracking-tight">Smart Step Classes</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-0.5 text-sm sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
            <Link to="/subjects"><BookOpen className="h-4 w-4 sm:hidden" /><span className="hidden sm:inline">Subjects</span></Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
            <Link to="/auth"><Shield className="h-4 w-4 sm:hidden" /><span className="hidden sm:inline">Admin</span></Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
