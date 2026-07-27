import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminStats,
  adminListSubjects, upsertSubject, deleteSubject,
  adminListChapters, upsertChapter, deleteChapter,
  adminListBanks, createBank, deleteBank, createBankUploadUrl,
  adminListQuestions, updateQuestion, deleteQuestions,
  adminListTests, upsertTest, deleteTest, getTestQuestions,
} from "@/lib/admin.functions";
import { extractQuestionsFromBank } from "@/lib/extract.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BarChart3, BookOpen, Layers, FileStack, ListChecks, ClipboardList,
  Plus, Trash2, Pencil, Loader2, LogOut, Sparkles, Upload, RefreshCw, GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Examly" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const [tab, setTab] = useState("dashboard");
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground"><GraduationCap className="h-4 w-4" /></div>
            <span className="font-bold">Examly Admin</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="glass grid w-full grid-cols-6">
            <TabsTrigger value="dashboard"><BarChart3 className="mr-2 h-4 w-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="subjects"><BookOpen className="mr-2 h-4 w-4" />Subjects</TabsTrigger>
            <TabsTrigger value="chapters"><Layers className="mr-2 h-4 w-4" />Chapters</TabsTrigger>
            <TabsTrigger value="banks"><FileStack className="mr-2 h-4 w-4" />Question Banks</TabsTrigger>
            <TabsTrigger value="questions"><ListChecks className="mr-2 h-4 w-4" />Questions</TabsTrigger>
            <TabsTrigger value="tests"><ClipboardList className="mr-2 h-4 w-4" />Tests</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-6"><DashboardTab /></TabsContent>
          <TabsContent value="subjects" className="mt-6"><SubjectsTab /></TabsContent>
          <TabsContent value="chapters" className="mt-6"><ChaptersTab /></TabsContent>
          <TabsContent value="banks" className="mt-6"><BanksTab /></TabsContent>
          <TabsContent value="questions" className="mt-6"><QuestionsTab /></TabsContent>
          <TabsContent value="tests" className="mt-6"><TestsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ================= DASHBOARD =================
function DashboardTab() {
  const fn = useServerFn(adminStats);
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn() });
  if (isLoading || !data) return <SkeletonRow />;
  const cards = [
    { label: "Subjects", value: data.subjects },
    { label: "Question Banks", value: data.banks },
    { label: "Questions", value: data.questions },
    { label: "Tests", value: data.tests },
    { label: "Published", value: data.published },
    { label: "Drafts", value: data.draft },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="glass p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-3xl font-bold gradient-text">{c.value}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass p-5">
          <h3 className="mb-3 font-semibold">Recent question banks</h3>
          <div className="space-y-2">
            {data.recentBanks.length === 0 && <p className="text-sm text-muted-foreground">No banks yet.</p>}
            {data.recentBanks.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <div className="truncate">{b.title}</div>
                <div className="flex items-center gap-2">
                  <Badge variant={b.extraction_status === "completed" ? "default" : "secondary"}>{b.extraction_status}</Badge>
                  <span className="text-xs text-muted-foreground">{b.question_count ?? 0} Qs</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="glass p-5">
          <h3 className="mb-3 font-semibold">Recent attempts</h3>
          <div className="space-y-2">
            {data.recentAttempts.length === 0 && <p className="text-sm text-muted-foreground">No attempts yet.</p>}
            {data.recentAttempts.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <div>{a.student_name || "Anonymous"}</div>
                <div className="text-xs text-muted-foreground">{Number(a.obtained_marks ?? 0)} / {Number(a.total_marks ?? 0)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return <div className="grid animate-pulse grid-cols-2 gap-4 md:grid-cols-4">{Array.from({length:4}).map((_,i)=><Card key={i} className="glass h-24"/>)}</div>;
}

// ================= SUBJECTS =================
function SubjectsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListSubjects);
  const upsert = useServerFn(upsertSubject);
  const del = useServerFn(deleteSubject);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-subjects"], queryFn: () => list() });
  const [edit, setEdit] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-subjects"] }); setEdit(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-subjects"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="glass p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Subjects</h3>
        <Button onClick={() => setEdit({ name: "", description: "", status: "published" })}><Plus className="mr-2 h-4 w-4" />New subject</Button>
      </div>
      {isLoading ? <SkeletonRow /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Order</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {data.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell><Badge variant={s.status === "published" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                <TableCell>{s.sort_order}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete subject?")) remove.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No subjects yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit subject" : "New subject"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Icon (emoji)</Label><Input value={edit.icon || ""} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} placeholder="📘" /></div>
                <div><Label>Status</Label>
                  <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="hidden">Hidden</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(edit)}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ================= CHAPTERS =================
function ChaptersTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListChapters);
  const listSubj = useServerFn(adminListSubjects);
  const upsert = useServerFn(upsertChapter);
  const del = useServerFn(deleteChapter);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-chapters"], queryFn: () => list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["admin-subjects"], queryFn: () => listSubj() });
  const [edit, setEdit] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (p: any) => upsert({ data: p }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-chapters"] }); setEdit(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-chapters"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="glass p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Chapters</h3>
        <Button onClick={() => setEdit({ subject_id: subjects[0]?.id, name: "", status: "published" })} disabled={!subjects.length}><Plus className="mr-2 h-4 w-4" />New chapter</Button>
      </div>
      {isLoading ? <SkeletonRow /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {data.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.subject?.name}</TableCell>
                <TableCell><Badge variant={c.status === "published" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete chapter?")) remove.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No chapters yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit chapter" : "New chapter"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Subject</Label>
                <Select value={edit.subject_id} onValueChange={(v) => setEdit({ ...edit, subject_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div><Label>Status</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="hidden">Hidden</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(edit)}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ================= BANKS =================
function BanksTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListBanks);
  const listSubj = useServerFn(adminListSubjects);
  const listCh = useServerFn(adminListChapters);
  const createUrl = useServerFn(createBankUploadUrl);
  const create = useServerFn(createBank);
  const del = useServerFn(deleteBank);
  const extract = useServerFn(extractQuestionsFromBank);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-banks"], queryFn: () => list(), refetchInterval: 5000 });
  const { data: subjects = [] } = useQuery({ queryKey: ["admin-subjects"], queryFn: () => listSubj() });
  const { data: chapters = [] } = useQuery({ queryKey: ["admin-chapters"], queryFn: () => listCh() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", subject_id: null, chapter_id: null });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file || !form.title) { toast.error("Title and file required"); return; }
    setBusy(true);
    try {
      const { path, token } = await createUrl({ data: { file_name: file.name } });
      const { error: upErr } = await supabase.storage.from("question-banks").uploadToSignedUrl(path, token, file);
      if (upErr) throw upErr;
      await create({ data: { title: form.title, subject_id: form.subject_id, chapter_id: form.chapter_id, file_path: path, file_name: file.name, file_type: file.type || "application/octet-stream", file_size: file.size } });
      toast.success("Uploaded");
      setOpen(false); setFile(null); setForm({ title: "", subject_id: null, chapter_id: null });
      qc.invalidateQueries({ queryKey: ["admin-banks"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  const runExtract = useMutation({
    mutationFn: (id: string) => extract({ data: { bank_id: id } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin-banks"] });
      if (r?.ok === false) {
        toast.error(r.error || "Extraction failed. Please try again.");
      } else {
        toast.success(`Extracted ${r.count} questions`);
      }
    },
    onError: (e: any) => toast.error(e?.message || "Extraction failed. Please try again."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-banks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="glass p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Question banks</h3>
        <Button onClick={() => setOpen(true)}><Upload className="mr-2 h-4 w-4" />Upload bank</Button>
      </div>
      {isLoading ? <SkeletonRow /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead>Questions</TableHead><TableHead className="w-40" /></TableRow></TableHeader>
          <TableBody>
            {data.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.title}<div className="text-xs text-muted-foreground">{b.file_name}</div></TableCell>
                <TableCell>{b.subject?.name || "—"}</TableCell>
                <TableCell>
                  <Badge variant={b.extraction_status === "completed" ? "default" : b.extraction_status === "failed" ? "destructive" : "secondary"}>
                    {b.extraction_status === "processing" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {b.extraction_status}
                  </Badge>
                  {b.extraction_error && <div className="mt-1 max-w-xs truncate text-xs text-destructive" title={b.extraction_error}>{b.extraction_error}</div>}
                </TableCell>
                <TableCell>{b.question_count ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={
                      b.extraction_status === "processing" ||
                      runExtract.isPending ||
                      (runExtract.variables as string | undefined) === b.id
                    }
                    onClick={() => runExtract.mutate(b.id)}
                  >
                    {runExtract.isPending && (runExtract.variables as string | undefined) === b.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    Extract
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete bank?")) remove.mutate(b.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No banks uploaded yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Upload question bank</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Subject (optional)</Label>
                <Select value={form.subject_id ?? "none"} onValueChange={(v) => setForm({ ...form, subject_id: v === "none" ? null : v, chapter_id: null })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Chapter (optional)</Label>
                <Select value={form.chapter_id ?? "none"} onValueChange={(v) => setForm({ ...form, chapter_id: v === "none" ? null : v })} disabled={!form.subject_id}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{chapters.filter((c: any) => c.subject_id === form.subject_id).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>File (PDF or TXT)</Label>
              <Input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <div className="mt-1 text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={upload}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ================= QUESTIONS =================
function QuestionsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListQuestions);
  const listSubj = useServerFn(adminListSubjects);
  const listBanks = useServerFn(adminListBanks);
  const update = useServerFn(updateQuestion);
  const delMany = useServerFn(deleteQuestions);
  const [filters, setFilters] = useState<{ bank_id?: string; subject_id?: string; search?: string }>({});
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-questions", filters], queryFn: () => list({ data: filters }) });
  const { data: subjects = [] } = useQuery({ queryKey: ["admin-subjects"], queryFn: () => listSubj() });
  const { data: banks = [] } = useQuery({ queryKey: ["admin-banks"], queryFn: () => listBanks() });
  const [edit, setEdit] = useState<any | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const save = useMutation({
    mutationFn: (p: any) => update({ data: p }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-questions"] }); setEdit(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (ids: string[]) => delMany({ data: { ids } }),
    onSuccess: () => { toast.success("Deleted"); setSel(new Set()); qc.invalidateQueries({ queryKey: ["admin-questions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="glass p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-semibold">Questions</h3>
        <Input placeholder="Search…" className="w-56" value={filters.search || ""} onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })} />
        <Select value={filters.subject_id ?? "all"} onValueChange={(v) => setFilters({ ...filters, subject_id: v === "all" ? undefined : v })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.bank_id ?? "all"} onValueChange={(v) => setFilters({ ...filters, bank_id: v === "all" ? undefined : v })}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Bank" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All banks</SelectItem>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
        </Select>
        {sel.size > 0 && <Button variant="destructive" size="sm" onClick={() => { if (confirm(`Delete ${sel.size} questions?`)) remove.mutate([...sel]); }}><Trash2 className="mr-1 h-4 w-4" />Delete {sel.size}</Button>}
      </div>
      {isLoading ? <SkeletonRow /> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-10"><Checkbox checked={sel.size > 0 && sel.size === data.length} onCheckedChange={(c) => setSel(c ? new Set(data.map((q: any) => q.id)) : new Set())} /></TableHead>
            <TableHead>#</TableHead><TableHead>Question</TableHead><TableHead>Type</TableHead><TableHead>Difficulty</TableHead><TableHead>Marks</TableHead><TableHead className="w-20" />
          </TableRow></TableHeader>
          <TableBody>
            {data.map((q: any) => (
              <TableRow key={q.id}>
                <TableCell><Checkbox checked={sel.has(q.id)} onCheckedChange={(c) => { const n = new Set(sel); c ? n.add(q.id) : n.delete(q.id); setSel(n); }} /></TableCell>
                <TableCell className="text-muted-foreground">{q.question_number ?? ""}</TableCell>
                <TableCell className="max-w-md truncate">{q.question_text}</TableCell>
                <TableCell><Badge variant="outline">{q.question_type}</Badge></TableCell>
                <TableCell><Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "easy" ? "secondary" : "default"}>{q.difficulty}</Badge></TableCell>
                <TableCell>{Number(q.marks)}</TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => setEdit(q)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No questions. Extract from a bank first.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      <QuestionEditor edit={edit} setEdit={setEdit} save={save} subjects={subjects} />
    </Card>
  );
}

function QuestionEditor({ edit, setEdit, save, subjects }: any) {
  if (!edit) return null;
  const opts: string[] = Array.isArray(edit.options) ? edit.options : [];
  const correct = edit.correct_answer;
  return (
    <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
      <DialogContent className="glass max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit question</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Question text</Label><Textarea rows={4} value={edit.question_text} onChange={(e) => setEdit({ ...edit, question_text: e.target.value })} /></div>
          <div><Label>Options</Label>
            <div className="space-y-2">
              {opts.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox checked={Array.isArray(correct) ? correct.includes(o) : correct === o} onCheckedChange={(c) => {
                    if (edit.question_type === "multiple_correct") {
                      const arr = Array.isArray(correct) ? [...correct] : [];
                      setEdit({ ...edit, correct_answer: c ? [...arr, o] : arr.filter((x) => x !== o) });
                    } else {
                      setEdit({ ...edit, correct_answer: c ? o : null });
                    }
                  }} />
                  <Input value={o} onChange={(e) => { const n = [...opts]; n[i] = e.target.value; setEdit({ ...edit, options: n, correct_answer: correct === o ? e.target.value : correct }); }} />
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ ...edit, options: opts.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setEdit({ ...edit, options: [...opts, ""] })}><Plus className="mr-1 h-3 w-3" />Add option</Button>
            </div>
          </div>
          <div><Label>Explanation</Label><Textarea rows={3} value={edit.explanation || ""} onChange={(e) => setEdit({ ...edit, explanation: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Difficulty</Label>
              <Select value={edit.difficulty || "medium"} onValueChange={(v) => setEdit({ ...edit, difficulty: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Marks</Label><Input type="number" min={0} value={Number(edit.marks) || 1} onChange={(e) => setEdit({ ...edit, marks: Number(e.target.value) })} /></div>
            <div><Label>Negative</Label><Input type="number" min={0} step="0.25" value={Number(edit.negative_marks) || 0} onChange={(e) => setEdit({ ...edit, negative_marks: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={edit.question_type} onValueChange={(v) => setEdit({ ...edit, question_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_correct">Single correct</SelectItem>
                  <SelectItem value="multiple_correct">Multiple correct</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="fill_blank">Fill in the blank</SelectItem>
                  <SelectItem value="numerical">Numerical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Subject</Label>
              <Select value={edit.subject_id ?? "none"} onValueChange={(v) => setEdit({ ...edit, subject_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={!!edit.is_reviewed} onCheckedChange={(c) => setEdit({ ...edit, is_reviewed: c })} /><Label>Reviewed</Label></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate({
            id: edit.id, question_text: edit.question_text, options: edit.options, correct_answer: edit.correct_answer,
            explanation: edit.explanation, difficulty: edit.difficulty, marks: Number(edit.marks) || 1, negative_marks: Number(edit.negative_marks) || 0,
            question_type: edit.question_type, subject_id: edit.subject_id, chapter_id: edit.chapter_id, is_reviewed: edit.is_reviewed,
          })}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================= TESTS =================
function TestsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListTests);
  const listSubj = useServerFn(adminListSubjects);
  const listQs = useServerFn(adminListQuestions);
  const getQs = useServerFn(getTestQuestions);
  const upsert = useServerFn(upsertTest);
  const del = useServerFn(deleteTest);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-tests"], queryFn: () => list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["admin-subjects"], queryFn: () => listSubj() });
  const [edit, setEdit] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (p: any) => upsert({ data: p }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-tests"] }); setEdit(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-tests"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  async function openEdit(t: any) {
    const question_ids = t?.id ? await getQs({ data: { test_id: t.id } }) : [];
    setEdit({
      duration_minutes: 30, passing_marks: 0, negative_marking: false, negative_mark_value: 0,
      shuffle_questions: false, shuffle_options: false, status: "draft", is_featured: false,
      ...t, question_ids,
    });
  }

  return (
    <Card className="glass p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Test series</h3>
        <Button onClick={() => openEdit({ name: "" })}><Plus className="mr-2 h-4 w-4" />New test</Button>
      </div>
      {isLoading ? <SkeletonRow /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Subject</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {data.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.subject?.name || "—"}</TableCell>
                <TableCell>{t.duration_minutes} min</TableCell>
                <TableCell><Badge variant={t.status === "published" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete test?")) remove.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No tests yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      {edit && <TestEditor edit={edit} setEdit={setEdit} save={save} subjects={subjects} listQs={listQs} />}
    </Card>
  );
}

function TestEditor({ edit, setEdit, save, subjects, listQs }: any) {
  const [availableQs, setAvailableQs] = useState<any[]>([]);
  const [qFilter, setQFilter] = useState("");
  useEffect(() => { listQs({ data: { subject_id: edit.subject_id || undefined } }).then(setAvailableQs); }, [edit.subject_id]);
  const selected = new Set<string>(edit.question_ids || []);
  const filtered = useMemo(() => availableQs.filter((q: any) => !qFilter || q.question_text.toLowerCase().includes(qFilter.toLowerCase())), [availableQs, qFilter]);
  const totalMarks = availableQs.filter((q: any) => selected.has(q.id)).reduce((s: number, q: any) => s + Number(q.marks || 0), 0);
  return (
    <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
      <DialogContent className="glass max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{edit.id ? "Edit test" : "New test"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div><Label>Subject (optional)</Label>
              <Select value={edit.subject_id ?? "none"} onValueChange={(v) => setEdit({ ...edit, subject_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Duration (min)</Label><Input type="number" min={1} value={edit.duration_minutes} onChange={(e) => setEdit({ ...edit, duration_minutes: Number(e.target.value) })} /></div>
              <div><Label>Passing marks</Label><Input type="number" min={0} value={edit.passing_marks} onChange={(e) => setEdit({ ...edit, passing_marks: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Instructions</Label><Textarea rows={3} value={edit.instructions || ""} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={edit.negative_marking} onCheckedChange={(c) => setEdit({ ...edit, negative_marking: c })} /><Label>Negative marking</Label>
              {edit.negative_marking && <Input type="number" min={0} step="0.25" className="ml-2 w-24" value={edit.negative_mark_value} onChange={(e) => setEdit({ ...edit, negative_mark_value: Number(e.target.value) })} />}
            </div>
            <div className="flex items-center gap-2"><Switch checked={edit.shuffle_questions} onCheckedChange={(c) => setEdit({ ...edit, shuffle_questions: c })} /><Label>Shuffle questions</Label></div>
            <div className="flex items-center gap-2"><Switch checked={edit.shuffle_options} onCheckedChange={(c) => setEdit({ ...edit, shuffle_options: c })} /><Label>Shuffle options</Label></div>
            <div className="flex items-center gap-2"><Switch checked={edit.is_featured} onCheckedChange={(c) => setEdit({ ...edit, is_featured: c })} /><Label>Featured</Label></div>
            <div><Label>Status</Label>
              <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="hidden">Hidden</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>Questions ({selected.size} · {totalMarks} marks)</Label><Input placeholder="Search…" className="w-40" value={qFilter} onChange={(e) => setQFilter(e.target.value)} /></div>
            <div className="max-h-[500px] space-y-1 overflow-y-auto rounded-md border border-white/5 p-2">
              {filtered.map((q: any) => (
                <label key={q.id} className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-white/5">
                  <Checkbox className="mt-1" checked={selected.has(q.id)} onCheckedChange={(c) => {
                    const arr = new Set(edit.question_ids || []);
                    c ? arr.add(q.id) : arr.delete(q.id);
                    setEdit({ ...edit, question_ids: [...arr] });
                  }} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate">{q.question_text}</div>
                    <div className="mt-0.5 flex gap-2 text-xs text-muted-foreground"><span>{q.difficulty}</span><span>{Number(q.marks)}m</span></div>
                  </div>
                </label>
              ))}
              {filtered.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No questions.</div>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
          <Button disabled={save.isPending} onClick={() => {
            const { subject, ...rest } = edit;
            save.mutate(rest);
          }}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}