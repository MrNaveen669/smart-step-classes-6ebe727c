import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAdmin, checkSetupStatus } from "@/lib/bootstrap.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Admin Sign In — Smart Step Classes" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const check = useServerFn(checkSetupStatus);
  const bootstrap = useServerFn(bootstrapAdmin);
  const { data: status, refetch } = useQuery({ queryKey: ["setup-status"], queryFn: () => check() });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin" as any });
    });
  }, [navigate]);

  const isSetup = status?.needsSetup === true;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSetup) {
        await bootstrap({ data: { email, password } });
        toast.success("Admin account created. Signing you in…");
        await refetch();
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/admin" as any });
    } catch (err: any) {
      toast.error(err.message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="glass w-full max-w-md p-5 shadow-card sm:p-8">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-bold">Smart Step Classes Admin</span>
        </Link>
        <h1 className="text-2xl font-bold">{isSetup ? "Create first admin" : "Admin sign in"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSetup ? "One-time setup. This form disables after the first admin is created." : "Sign in to manage subjects, tests, and question banks."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSetup ? "Create admin & sign in" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
