import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Role = "admin" | "editor" | "viewer";

/**
 * Ensures the authenticated user has at least one of the allowed roles.
 * Throws an Error("Forbidden") if the user has no matching role assignment.
 * Prevents self-signed-up accounts (with no roles) from calling paid AI/health endpoints.
 */
export async function requireAnyRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  roles: Role[] = ["admin", "editor", "viewer"],
): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", roles)
    .limit(1);
  if (error) throw new Error("Forbidden");
  if (!data || data.length === 0) throw new Error("Forbidden: role required");
}
