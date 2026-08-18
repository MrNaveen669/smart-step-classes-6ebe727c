import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Timer, Brain, Trophy, Search, BookOpen, ShieldCheck } from "lucide-react";
import { listPublishedSubjects, listPublishedTests } from "@/lib/queries.functions";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

const subjectsQ = queryOptions({ queryKey: ["public-subjects"], queryFn: () => listPublishedSubjects() });
const testsQ = queryOptions({ queryKey: ["public-tests"], queryFn: () => listPublishedTests() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Step Classes — AI-Powered Online Test Series" },
      { name: "description", content: "Practice timed mock tests across programming, cyber security, networking, reasoning and English. Instant AI-graded results with explanations." },
      { property: "og:title", content: "Smart Step Classes — AI-Powered Online Test Series" },
      { property: "og:description", content: "Timed practice tests with instant results and detailed answer explanations." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(subjectsQ);
    context.queryClient.ensureQueryData(testsQ);
  },
  component: Landing,
});

function Landing() {
  const { data: subjects } = useSuspenseQuery(subjectsQ);
  const { data: tests } = useSuspenseQuery(testsQ);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tests;
    return tests.filter((t) => t.name.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s));
  }, [q, tests]);
  const featured = tests.filter((t) => t.is_featured).slice(0, 3);
  const latest = tests.slice(0, 6);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-glow opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 sm:pb-24 sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <Badge variant="outline" className="glass mb-6 gap-1.5 border-border">
              <Sparkles className="h-3 w-3" /> Powered by AI-extracted question banks
            </Badge>
            {/* <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-7xl">
              Master any exam with <span className="gradient-text">timed practice</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Unlimited mock tests across programming, cyber security, reasoning and more. Real-time results, detailed explanations, and a distraction-free interface built for focus.
            </p> */}
            <div className="mx-auto mt-8 flex max-w-lg flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search tests, subjects, chapters…"
                  className="glass h-12 pl-9 text-base"
                />
              </div>
              <Button asChild size="lg" className="w-full bg-gradient-primary text-primary-foreground shadow-glow sm:w-auto">
                <Link to="/subjects">
                  Browse <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mx-auto mt-10 grid max-w-2xl gap-4 text-sm sm:grid-cols-3">
              <Stat icon={<BookOpen className="h-4 w-4" />} label="Subjects" value={subjects.length} />
              <Stat icon={<Timer className="h-4 w-4" />} label="Tests" value={tests.length} />
              <Stat icon={<Brain className="h-4 w-4" />} label="AI-Graded" value="100%" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURED */}
      {featured.length > 0 && (
        <Section title="Featured tests" subtitle="Hand-picked papers to get you started">
          <div className="grid gap-4 md:grid-cols-3">
            {featured.map((t, i) => (
              <TestCard key={t.id} t={t} index={i} featured />
            ))}
          </div>
        </Section>
      )}

      {/* SUBJECTS */}
      <Section title="Explore by subject" subtitle="Focus on what matters most">
        {subjects.length === 0 ? (
          <EmptyState message="No subjects published yet." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <Link to="/subjects" hash={s.slug}>
                  <Card className="glass group h-full cursor-pointer p-6 transition-all hover:border-primary/40 hover:shadow-glow">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary text-primary-foreground">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold">{s.name}</h3>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{s.description || "Practice tests curated for this subject."}</p>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </Section>

      {/* LATEST */}
      <Section title={q ? `Results for "${q}"` : "Latest tests"} subtitle={q ? `${filtered.length} matching` : "Fresh papers, ready to attempt"}>
        {(q ? filtered : latest).length === 0 ? (
          <EmptyState message="No tests published yet." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(q ? filtered : latest).map((t, i) => (
              <TestCard key={t.id} t={t} index={i} />
            ))}
          </div>
        )}
      </Section>

      {/* WHY */}
      <Section title="Built for serious learners" subtitle="Everything you need, nothing you don't">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon={<Timer />} title="Real timed exams" desc="Auto-submit at zero. Question palette, mark for review, and answer navigator." />
          <FeatureCard icon={<Brain />} title="Detailed explanations" desc="Every question comes with a worked explanation. Learn from your mistakes." />
          <FeatureCard icon={<ShieldCheck />} title="No signup needed" desc="Start practicing instantly. Your session is private and saved locally." />
        </div>
      </Section>

      <footer className="mt-24 border-t border-border py-10">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Smart Step Classes. Built for focused practice.
        </div>
      </footer>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon, label, value }: any) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-1 flex items-center justify-center gap-1 text-muted-foreground">{icon}<span className="text-xs uppercase tracking-wide">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function TestCard({ t, index, featured }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
      <Link to="/tests/$slug" params={{ slug: t.slug }}>
        <Card className={`glass group h-full cursor-pointer p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow ${featured ? "border-primary/30" : ""}`}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <Badge variant="secondary" className="text-[10px]">{t.is_free ? "FREE" : "PAID"}</Badge>
            {featured && <Trophy className="h-4 w-4 text-primary" />}
          </div>
          <h3 className="text-lg font-semibold leading-tight group-hover:text-primary">{t.name}</h3>
          {t.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {t.duration_minutes} min</span>
            <span>{Number(t.total_marks || 0)} marks</span>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <Card className="glass p-6">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary text-primary-foreground">{icon}</div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="glass p-10 text-center text-muted-foreground">
      <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-50" />
      {message}
    </Card>
  );
}
