import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * One-time admin bootstrap. Only works when zero admins exist yet.
 * After the first admin is created, this endpoint always returns { alreadySetup: true }.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email().max(200),
      password: z.string().min(6).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if any admin already exists
    const { data: existing, error: chkErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (chkErr) throw new Error(chkErr.message);
    // For head:true, `data` is null and count is on the response — refetch to be safe:
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) return { alreadySetup: true };

    // Create the auth user (auto-confirm email)
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (cErr) throw new Error(cErr.message);
    const uid = created.user!.id;

    await supabaseAdmin.from("profiles").upsert({ id: uid, email: data.email }).throwOnError();
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" }).throwOnError();
    return { alreadySetup: false, email: data.email };
  });

export const checkSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { needsSetup: (count ?? 0) === 0 };
});