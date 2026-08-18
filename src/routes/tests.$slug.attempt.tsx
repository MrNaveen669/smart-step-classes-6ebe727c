import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { getPublishedTestBySlug } from "@/lib/queries.functions";
import { submitAttempt } from "@/lib/attempts.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Timer, ChevronLeft, ChevronRight, Flag, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

const testQ = (slug: string) => queryOptions({ queryKey: ["test", slug], queryFn: () => getPublishedTestBySlug({ data: { slug } }) });

export const Route = createFileRoute("/tests/$slug/attempt")({
  head: () => ({ meta: [{ title: "Attempt — Examly" }, { name: "robots", content: "noindex" }] }),
  validateSearch: z.object({ a: z.string() }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(testQ(params.slug)),
  component: AttemptPage,
});

function AttemptPage() {
  const { slug } = Route.useParams();
  const { a: attemptId } = Route.useSearch();
  const { data } = useSuspenseQuery(testQ(slug));
  const navigate = useNavigate();
  const submit = useServerFn(submitAttempt);

  if (!data) return <div className="p-8 text-center">Test not found.</div>;
  const { test, questions } = data;

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const durationMs = test.duration_minutes * 60 * 1000;
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const remaining = Math.max(0, durationMs - (now - startedAt.current));
  const mm = Math.floor(remaining / 60000).toString().padStart(2, "0");
  const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");

  const current = questions[idx]?.question as any;
  useEffect(() => { if (current?.id) setVisited((v) => new Set(v).add(current.id)); }, [current?.id]);

  async function doSubmit() {
    setSubmitting(true);
    try {
      const sessionId = localStorage.getItem("session_id");
      if (!sessionId) throw new Error("This attempt does not belong to this browser session.");
      await submit({ data: { attempt_id: attemptId, session_id: sessionId, answers } });
      navigate({ to: "/tests/$slug/result" as any, params: { slug } as any, search: { a: attemptId } as any });
    } catch (e: any) { toast.error(e.message); setSubmitting(false); }
  }

  useEffect(() => { if (remaining <= 0 && !submitting) { toast.info("Time's up — submitting"); doSubmit(); } }, [remaining]);

  if (!current) {
    return <div className="p-8 text-center"><p>This test has no questions.</p><Button asChild className="mt-4"><Link to="/">Home</Link></Button></div>;
  }

  const opts: string[] = Array.isArray(current.options) ? current.options : [];
  const type = current.question_type as string;
  const val = answers[current.id];
  const answered = questions.filter((q: any) => answers[q.question.id] != null && answers[q.question.id] !== "" && !(Array.isArray(answers[q.question.id]) && answers[q.question.id].length === 0)).length;

  function toggleFlag() {
    const n = new Set(flagged); n.has(current.id) ? n.delete(current.id) : n.add(current.id); setFlagged(n);
  }
  function setAns(v: any) { setAnswers({ ...answers, [current.id]: v }); }

  const lowTime = remaining < 60_000;

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b border-white/5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
          <div className="min-w-0 flex-1 basis-44"><div className="truncate font-semibold">{test.name}</div><div className="text-xs text-muted-foreground">Question {idx + 1} of {questions.length}</div></div>
          <div className={`flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 font-mono text-base sm:text-lg ${lowTime ? "border-destructive/50 text-destructive shadow-glow" : ""}`}>
            <Timer className="h-4 w-4" />{mm}:{ss}
          </div>
          <Button onClick={() => setConfirmOpen(true)} className="shrink-0 bg-gradient-primary text-primary-foreground shadow-glow"><Send className="mr-1 h-4 w-4 sm:mr-2" />Submit</Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <Card className="glass min-w-0 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="outline">Q{idx + 1}</Badge>
              <Badge variant="secondary">{Number(current.marks)} mark{Number(current.marks) === 1 ? "" : "s"}</Badge>
              {test.negative_marking && <Badge variant="destructive">-{test.negative_mark_value}</Badge>}
            </div>
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed sm:text-lg">{current.question_text}</p>
            <div className="mt-6 space-y-2">
              {type === "single_correct" || type === "true_false" || type === "image_based" ? (
                opts.map((o) => (
                  <label key={o} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${val === o ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/20 hover:bg-white/5"}`}>
                    <input type="radio" name="q" checked={val === o} onChange={() => setAns(o)} className="h-4 w-4 accent-primary" />
                    <span className="min-w-0 break-words">{o}</span>
                  </label>
                ))
              ) : type === "multiple_correct" ? (
                opts.map((o) => {
                  const arr: string[] = Array.isArray(val) ? val : [];
                  const on = arr.includes(o);
                  return (
                    <label key={o} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${on ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/20 hover:bg-white/5"}`}>
                      <input type="checkbox" checked={on} onChange={(e) => setAns(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} className="h-4 w-4 accent-primary" />
                      <span className="min-w-0 break-words">{o}</span>
                    </label>
                  );
                })
              ) : (
                <Input value={val ?? ""} onChange={(e) => setAns(e.target.value)} placeholder="Type your answer" />
              )}
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={toggleFlag} className="w-full sm:w-auto"><Flag className={`mr-2 h-4 w-4 ${flagged.has(current.id) ? "fill-yellow-400 text-yellow-400" : ""}`} />{flagged.has(current.id) ? "Unmark" : "Mark for review"}</Button>
              <div className="grid grid-cols-3 gap-2 sm:flex">
                <Button variant="outline" onClick={() => setAns(null)} className="w-full">Clear</Button>
                <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="w-full px-2 sm:px-3"><ChevronLeft className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Previous</span></Button>
                <Button disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)} className="w-full px-2 sm:px-3"><span className="hidden sm:inline">Next</span><ChevronRight className="sm:ml-1 h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        </div>
        <aside className="min-w-0">
          <Card className="glass p-4 lg:sticky lg:top-24">
            <div className="mb-3 text-sm font-semibold">Palette</div>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
              {questions.map((q: any, i: number) => {
                const id = q.question.id;
                const isAnswered = answers[id] != null && answers[id] !== "" && !(Array.isArray(answers[id]) && answers[id].length === 0);
                const isFlagged = flagged.has(id);
                const isVisited = visited.has(id);
                const isCurrent = i === idx;
                let cls = "border-white/10 bg-white/5 text-muted-foreground";
                if (isAnswered && isFlagged) cls = "border-yellow-400 bg-yellow-400/10 text-yellow-300";
                else if (isAnswered) cls = "border-emerald-400 bg-emerald-400/10 text-emerald-300";
                else if (isFlagged) cls = "border-yellow-400 bg-yellow-400/10 text-yellow-300";
                else if (isVisited) cls = "border-red-400/60 bg-red-400/10 text-red-300";
                if (isCurrent) cls += " ring-2 ring-primary";
                return <button key={id} onClick={() => setIdx(i)} className={`h-9 w-9 rounded-md border text-sm font-semibold transition ${cls}`}>{i + 1}</button>;
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Answered</span><span className="font-semibold text-emerald-400">{answered}</span></div>
              <div className="flex justify-between"><span>Flagged</span><span className="font-semibold text-yellow-400">{flagged.size}</span></div>
              <div className="flex justify-between"><span>Not visited</span><span>{questions.length - visited.size}</span></div>
            </div>
          </Card>
        </aside>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Submit test?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Answered</span><span className="font-semibold">{answered} / {questions.length}</span></div>
            <div className="flex justify-between"><span>Flagged for review</span><span className="font-semibold">{flagged.size}</span></div>
            <div className="flex justify-between"><span>Unanswered</span><span className="font-semibold text-red-400">{questions.length - answered}</span></div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} className="w-full sm:w-auto">Keep going</Button>
            <Button disabled={submitting} onClick={doSubmit} className="w-full sm:w-auto">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit final</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
