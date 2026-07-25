import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Examly" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Card className="glass p-10 text-center">
        <h1 className="text-2xl font-bold">Admin dashboard</h1>
        <p className="mt-2 text-muted-foreground">The full admin UI (subjects, chapters, banks, questions, tests) is being built in the next turn.</p>
        <Button asChild className="mt-6"><Link to="/">Back home</Link></Button>
      </Card>
    </div>
  ),
});