import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listPublishedSubjects, listPublishedTests } from "@/lib/queries.functions";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Timer } from "lucide-react";

const sQ = queryOptions({ queryKey: ["public-subjects"], queryFn: () => listPublishedSubjects() });
const tQ = queryOptions({ queryKey: ["public-tests"], queryFn: () => listPublishedTests() });

export const Route = createFileRoute("/subjects")({
  head: () => ({ meta: [{ title: "All Subjects — Examly" }, { name: "description", content: "Browse practice tests by subject." }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(sQ);
    context.queryClient.ensureQueryData(tQ);
  },
  component: SubjectsPage,
});

function SubjectsPage() {
  const { data: subjects } = useSuspenseQuery(sQ);
  const { data: tests } = useSuspenseQuery(tQ);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-3 py-8 sm:px-4 sm:py-12">
        <h1 className="mb-6 break-words text-3xl font-bold sm:mb-8 sm:text-4xl">All subjects</h1>
        {subjects.length === 0 ? (
          <Card className="glass p-6 text-center text-muted-foreground sm:p-10">No subjects published yet.</Card>
        ) : (
          <div className="space-y-10">
            {subjects.map((s) => {
              const subTests = tests.filter((t) => t.subject_id === s.id);
              return (
                <section key={s.id} id={s.slug}>
                  <h2 className="mb-4 break-words text-2xl font-semibold">{s.name}</h2>
                  {subTests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tests yet.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {subTests.map((t) => (
                        <Link key={t.id} to="/tests/$slug" params={{ slug: t.slug }}>
                          <Card className="glass h-full min-w-0 p-4 transition-all hover:border-primary/40 hover:shadow-glow sm:p-5">
                            <h3 className="break-words font-semibold">{t.name}</h3>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                              <Timer className="h-3 w-3" /> {t.duration_minutes} min
                              <span>· {Number(t.total_marks)} marks</span>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
