import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isNight = theme === "night";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="shrink-0 px-2 sm:px-3"
      onClick={() => setTheme(isNight ? "light" : "night")}
      aria-label={`Switch to ${isNight ? "Light" : "Night"} Mode`}
      title={`Switch to ${isNight ? "Light" : "Night"} Mode`}
    >
      {isNight ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isNight ? "Light" : "Night"}</span>
    </Button>
  );
}
