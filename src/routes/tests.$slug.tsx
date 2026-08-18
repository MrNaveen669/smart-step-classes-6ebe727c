import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPublishedTestBySlug } from "@/lib/queries.functions";
import { startAttempt } from "@/lib/attempts.functions";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Timer, Award, ListChecks, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const testQ = (slug: string) => queryOptions({ queryKey: ["test", slug], queryFn: () => getPublishedTestBySlug({ data: { slug } }) });

export const Route = createFileRoute("/tests/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Examly` }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(testQ(params.slug)),
  component: TestRoute,
});

function TestRoute() {
  const { slug } = Route.useParams();
  const pathname = useLocation({ select: (location) => location.pathname });

  // `tests.$slug.attempt` and `tests.$slug.result` are child routes. The
  // parent must render an Outlet for them instead of continuing to render the
  // introduction page after navigation.
  if (pathname !== `/tests/${slug}`) return <Outlet />;

  return <TestDetail />;
}

function TestDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(testQ(slug));
  const navigate = useNavigate();
  const start = useServerFn(startAttempt);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);
  const [detailErrors, setDetailErrors] = useState<{ name?: string; email?: string }>({});

  if (!data) {
    return (
      <div className="min-h-screen"><SiteHeader />
        <div className="mx-auto max-w-3xl px-3 py-12 text-center sm:px-4 sm:py-16">
          <h1 className="text-2xl font-bold">Test not found</h1>
          <Button asChild variant="outline" className="mt-6"><Link to="/">Back home</Link></Button>
        </div>
      </div>
    );
  }
  const { test, questions } = data;

  function continueToInstructions() {
    const name = studentName.trim().replace(/\s+/g, " ");
    const email = studentEmail.trim().toLowerCase();
    const errors: { name?: string; email?: string } = {};
    if ((name.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 2) errors.name = "Please enter your name.";
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Please enter a valid email address.";
    setDetailErrors(errors);
    if (Object.keys(errors).length) return;
    setStudentName(name);
    setStudentEmail(email);
    setDetailsConfirmed(true);
  }

  async function begin() {
    setBusy(true);
    setStartError(null);
    try {
      const sid = localStorage.getItem("session_id") || crypto.randomUUID();
      localStorage.setItem("session_id", sid);
      const res = await start({ data: { test_series_id: test.id, session_id: sid, student_name: studentName, student_email: studentEmail } });
      if (!res?.id) throw new Error("The server did not return an attempt ID.");
      await navigate({ to: "/tests/$slug/attempt" as any, params: { slug } as any, search: { a: res.id } as any });
    } catch (error: unknown) {
      console.error("Could not start test", error);
      const message = error instanceof Error && error.message ? error.message : "Could not start test. Please try again.";
      const visibleMessage = `Unable to start test: ${message}`;
      setStartError(visibleMessage);
      toast.error(visibleMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-3 py-8 sm:px-4 sm:py-12">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Back</Link>
        <h1 className="break-words text-3xl font-bold sm:text-4xl">{test.name}</h1>
        {test.description && <p className="mt-2 text-muted-foreground">{test.description}</p>}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card className="glass p-4 text-center"><Timer className="mx-auto mb-1 h-5 w-5 text-primary" /><div className="text-2xl font-bold">{test.duration_minutes}</div><div className="text-xs text-muted-foreground">Minutes</div></Card>
          <Card className="glass p-4 text-center"><ListChecks className="mx-auto mb-1 h-5 w-5 text-primary" /><div className="text-2xl font-bold">{questions.length}</div><div className="text-xs text-muted-foreground">Questions</div></Card>
          <Card className="glass p-4 text-center"><Award className="mx-auto mb-1 h-5 w-5 text-primary" /><div className="text-2xl font-bold">{Number(test.total_marks)}</div><div className="text-xs text-muted-foreground">Marks</div></Card>
        </div>
        {!detailsConfirmed ? (
          <Card className="glass mt-6 p-4 sm:p-6">
            <h2 className="font-semibold">Before you begin</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter your details to continue to the test instructions.</p>
            <div className="mt-5 space-y-4">
              <div className="space-y-2"><Label htmlFor="student-name">Student Name</Label><Input id="student-name" value={studentName} maxLength={80} onChange={(e) => setStudentName(e.target.value)} autoComplete="name" />{detailErrors.name && <p className="text-sm text-destructive">{detailErrors.name}</p>}</div>
              <div className="space-y-2"><Label htmlFor="student-email">Gmail / Email</Label><Input id="student-email" type="email" value={studentEmail} maxLength={200} onChange={(e) => setStudentEmail(e.target.value)} autoComplete="email" />{detailErrors.email && <p className="text-sm text-destructive">{detailErrors.email}</p>}</div>
              <Button type="button" onClick={continueToInstructions} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">Continue</Button>
            </div>
          </Card>
        ) : <>
          <Card className="glass mt-6 p-4 sm:p-6">
            <h2 className="mb-2 font-semibold">Instructions</h2>
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
              {test.instructions || `• Total questions: ${questions.length}\n• Duration: ${test.duration_minutes} minutes\n• The timer starts as soon as you click "Start test".\n• You cannot pause. The test auto-submits at zero.\n${test.negative_marking ? `• Negative marking: -${test.negative_mark_value} per wrong answer.\n` : ""}• Do not refresh or close the tab during the exam.`}
            </div>
          </Card>
          <Button onClick={begin} disabled={busy || questions.length === 0} size="lg" className="mt-6 w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? "Starting test..." : "Start test"}
          </Button>
          {startError && <p role="alert" className="mt-2 text-center text-sm text-destructive">{startError}</p>}
        </>}
        {questions.length === 0 && <p className="mt-2 text-center text-sm text-muted-foreground">This test has no questions yet.</p>}
      </div>
    </div>
  );
}
