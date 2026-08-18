import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getAttemptResult } from "@/lib/attempts.functions";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, MinusCircle, Trophy, Target, Percent, Clock } from "lucide-react";

const resQ = (id: string, sessionId: string) => queryOptions({
  queryKey: ["result", id],
  queryFn: () => getAttemptResult({ data: { attempt_id: id, session_id: sessionId } }),
});

export const Route = createFileRoute("/tests/$slug/result")({
  ssr: false,
  head: () => ({ meta: [{ title: "Result — Examly" }, { name: "robots", content: "noindex" }] }),
  validateSearch: z.object({ a: z.string() }),
  loaderDeps: ({ search }) => ({ a: search.a }),
  loader: ({ context, deps }: any) => {
    const sessionId = localStorage.getItem("session_id");
    if (!sessionId) throw new Error("This result does not belong to this browser session.");
    return context.queryClient.ensureQueryData(resQ(deps.a, sessionId));
  },
  component: ResultPage,
});

function isEqualAnswer(a: any, b: any): boolean {
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const s = [...a].map(String).sort(); const t = [...b].map(String).sort();
    return s.every((v, i) => v === t[i]);
  }
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function ResultPage() {
  const { a } = Route.useSearch();
  const sessionId = localStorage.getItem("session_id") ?? "";
  const { data } = useSuspenseQuery(resQ(a, sessionId));
  const { attempt, questions } = data as any;
  const test = attempt.test;
  const answers = attempt.answers || {};
  const dur = attempt.duration_seconds || 0;
  const mm = Math.floor(dur / 60);
  const ss = dur % 60;

  const stats = [
    { icon: Trophy, label: "Score", value: `${Number(attempt.obtained_marks ?? 0)} / ${Number(attempt.total_marks ?? 0)}` },
    { icon: Percent, label: "Percentage", value: `${Number(attempt.percentage ?? 0).toFixed(1)}%` },
    { icon: Target, label: "Accuracy", value: `${Number(attempt.accuracy ?? 0).toFixed(1)}%` },
    { icon: Clock, label: "Time", value: `${mm}m ${ss}s` },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Card className={`glass overflow-hidden p-8 ${attempt.passed ? "shadow-glow" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{test?.name}</div>
              <h1 className="mt-1 text-4xl font-bold gradient-text">{attempt.passed ? "Passed 🎉" : "Better luck next time"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Passing marks: {Number(test?.passing_marks ?? 0)}</p>
            </div>
            <Button asChild variant="outline"><Link to="/">Back to tests</Link></Button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-white/5 bg-white/5 p-4">
                <s.icon className="h-4 w-4 text-primary" />
                <div className="mt-2 text-xs text-muted-foreground">{s.label}</div>
                <div className="text-2xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3"><div className="text-2xl font-bold text-emerald-400">{attempt.correct_count ?? 0}</div><div className="text-xs text-muted-foreground">Correct</div></div>
            <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3"><div className="text-2xl font-bold text-red-400">{attempt.wrong_count ?? 0}</div><div className="text-xs text-muted-foreground">Wrong</div></div>
            <div className="rounded-lg border border-white/10 p-3"><div className="text-2xl font-bold text-muted-foreground">{attempt.skipped_count ?? 0}</div><div className="text-xs text-muted-foreground">Skipped</div></div>
          </div>
        </Card>

        <h2 className="mb-3 mt-10 text-xl font-bold">Solutions</h2>
        <div className="space-y-3">
          {questions.map((row: any, i: number) => {
            const q = row.question;
            const given = answers[q.id];
            const gotIt = isEqualAnswer(given, q.correct_answer);
            const opts: string[] = Array.isArray(q.options) ? q.options : [];
            const correctSet = new Set<string>(Array.isArray(q.correct_answer) ? q.correct_answer.map(String) : q.correct_answer != null ? [String(q.correct_answer)] : []);
            const givenSet = new Set<string>(Array.isArray(given) ? given.map(String) : given != null && given !== "" ? [String(given)] : []);
            const status = givenSet.size === 0 ? "skipped" : gotIt ? "correct" : "wrong";
            return (
              <Card key={q.id} className="glass p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="outline">Q{i + 1}</Badge>
                  {status === "correct" && <Badge className="bg-emerald-500/20 text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" />Correct</Badge>}
                  {status === "wrong" && <Badge className="bg-red-500/20 text-red-300"><XCircle className="mr-1 h-3 w-3" />Wrong</Badge>}
                  {status === "skipped" && <Badge variant="secondary"><MinusCircle className="mr-1 h-3 w-3" />Skipped</Badge>}
                  <Badge variant="secondary">{Number(q.marks)}m</Badge>
                </div>
                <p className="whitespace-pre-wrap">{q.question_text}</p>
                {opts.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {opts.map((o) => {
                      const isCorrect = correctSet.has(o);
                      const isGiven = givenSet.has(o);
                      let cls = "border-white/10 bg-white/5";
                      if (isCorrect) cls = "border-emerald-400/40 bg-emerald-400/10";
                      else if (isGiven) cls = "border-red-400/40 bg-red-400/10";
                      return (
                        <div key={o} className={`flex items-center justify-between rounded-md border p-2.5 text-sm ${cls}`}>
                          <span>{o}</span>
                          <span className="text-xs">
                            {isCorrect && <span className="text-emerald-400">Correct answer</span>}
                            {isGiven && !isCorrect && <span className="text-red-400">Your answer</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {opts.length === 0 && (
                  <div className="mt-3 space-y-1 text-sm">
                    <div>Your answer: <span className={gotIt ? "text-emerald-400" : "text-red-400"}>{given ? String(given) : "—"}</span></div>
                    <div>Correct: <span className="text-emerald-400">{q.correct_answer != null ? String(q.correct_answer) : "—"}</span></div>
                  </div>
                )}
                {q.explanation && (
                  <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Explanation</div>
                    <p className="whitespace-pre-wrap text-muted-foreground">{q.explanation}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
