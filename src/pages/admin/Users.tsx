import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Shield, ShieldOff } from "lucide-react";

export default function AdminUsers() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");

  const { data: users } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      let q = supabase.from("profiles").select("user_id, username, display_name, email, created_at").order("created_at", { ascending: false }).limit(100);
      if (search) q = q.or(`username.ilike.%${search}%,email.ilike.%${search}%,display_name.ilike.%${search}%`);
      const { data } = await q;
      const ids = (data ?? []).map((p) => p.user_id);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      const adminSet = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (data ?? []).map((p) => ({ ...p, is_admin: adminSet.has(p.user_id) }));
    },
  });

  const grant = useMutation({
    mutationFn: async (uid: string) => { await supabase.from("user_roles").insert({ user_id: uid, role: "admin" }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Admin granted"); },
  });

  const revoke = useMutation({
    mutationFn: async (uid: string) => { await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin"); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Admin revoked"); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display tracking-wider uppercase">Users</h1>
      <Input placeholder="Search by name, username, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md rounded-none" />
      <Card className="rounded-none border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((u: any) => (
              <TableRow key={u.user_id}>
                <TableCell>
                  <div className="font-medium">{u.display_name || u.username || "—"}</div>
                  <div className="text-xs text-muted-foreground">@{u.username}</div>
                </TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell className="text-sm">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  {u.is_admin ? <Badge className="rounded-none">Admin</Badge> : <Badge variant="outline" className="rounded-none">User</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {u.is_admin ? (
                    <Button size="sm" variant="ghost" disabled={u.user_id === me?.id} onClick={() => revoke.mutate(u.user_id)} className="h-8 gap-1">
                      <ShieldOff className="w-4 h-4" /> Revoke
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => grant.mutate(u.user_id)} className="h-8 gap-1">
                      <Shield className="w-4 h-4" /> Make Admin
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
