import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPublishedTestBySlug } from "@/lib/queries.functions";
import { startAttempt } from "@/lib/attempts.functions";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer, Award, ListChecks, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const testQ = (slug: string) => queryOptions({ queryKey: ["test", slug], queryFn: () => getPublishedTestBySlug({ data: { slug } }) });

export const Route = createFileRoute("/tests/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Examly` }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(testQ(params.slug)),
  component: TestDetail,
});

function TestDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(testQ(slug));
  const navigate = useNavigate();
  const start = useServerFn(startAttempt);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  if (!data) {
    return (
      <div className="min-h-screen"><SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Test not found</h1>
          <Button asChild variant="outline" className="mt-6"><Link to="/">Back home</Link></Button>
        </div>
      </div>
    );
  }
  const { test, questions } = data;

  async function begin() {
    setBusy(true);
    setStartError(null);
    try {
      const sid = localStorage.getItem("session_id") || crypto.randomUUID();
      localStorage.setItem("session_id", sid);
      const res = await start({ data: { test_series_id: test.id, session_id: sid } });
      if (!res?.id) throw new Error("The server did not return an attempt ID.");
      await navigate({ to: "/tests/$slug/attempt" as any, params: { slug } as any, search: { a: res.id } as any });
    } catch (error: unknown) {
      console.error("Could not start test", error);
      const message = error instanceof Error && error.message ? error.message : "Could not start test. Please try again.";
      setStartError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Back</Link>
        <h1 className="text-4xl font-bold">{test.name}</h1>
        {test.description && <p className="mt-2 text-muted-foreground">{test.description}</p>}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Card className="glass p-4 text-center"><Timer className="mx-auto mb-1 h-5 w-5 text-primary" /><div className="text-2xl font-bold">{test.duration_minutes}</div><div className="text-xs text-muted-foreground">Minutes</div></Card>
          <Card className="glass p-4 text-center"><ListChecks className="mx-auto mb-1 h-5 w-5 text-primary" /><div className="text-2xl font-bold">{questions.length}</div><div className="text-xs text-muted-foreground">Questions</div></Card>
          <Card className="glass p-4 text-center"><Award className="mx-auto mb-1 h-5 w-5 text-primary" /><div className="text-2xl font-bold">{Number(test.total_marks)}</div><div className="text-xs text-muted-foreground">Marks</div></Card>
        </div>
        <Card className="glass mt-6 p-6">
          <h2 className="mb-2 font-semibold">Instructions</h2>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
            {test.instructions || `• Total questions: ${questions.length}\n• Duration: ${test.duration_minutes} minutes\n• The timer starts as soon as you click "Start test".\n• You cannot pause. The test auto-submits at zero.\n${test.negative_marking ? `• Negative marking: -${test.negative_mark_value} per wrong answer.\n` : ""}• Do not refresh or close the tab during the exam.`}
          </div>
        </Card>
        <Button onClick={begin} disabled={busy || questions.length === 0} size="lg" className="mt-6 w-full bg-gradient-primary text-primary-foreground shadow-glow">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Start test
        </Button>
        {startError && <p role="alert" className="mt-2 text-center text-sm text-destructive">{startError}</p>}
        {questions.length === 0 && <p className="mt-2 text-center text-sm text-muted-foreground">This test has no questions yet.</p>}
      </div>
    </div>
  );
}
