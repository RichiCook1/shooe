import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, CheckCircle2, RefreshCw, Sparkles, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminCatalog() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unverified" | "missing_image" | "pending" | "user_submitted">("all");

  const { data: brands } = useQuery({
    queryKey: ["admin-brands", search],
    queryFn: async () => {
      let q = supabase.from("brands").select("*").order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data } = await q.limit(200);
      return data ?? [];
    },
  });

  const { data: models } = useQuery({
    queryKey: ["admin-models", search, filter],
    queryFn: async () => {
      let q = supabase.from("models").select("*, brands(name)").order("created_at", { ascending: false });
      if (search) q = q.ilike("name", `%${search}%`);
      if (filter === "unverified") q = q.eq("verified", false);
      if (filter === "missing_image") q = q.is("image_url", null);
      if (filter === "pending") q = q.eq("pending_review", true);
      if (filter === "user_submitted") q = q.eq("source", "user_submitted");
      const { data } = await q.limit(300);
      return data ?? [];
    },
  });

  const enrichOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("enrich-shoe-images", { body: { modelId: id } });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-models"] }); toast.success("Image enriched"); },
    onError: (e: any) => toast.error(e.message),
  });

  const verifyModel = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("models").update({ verified: true, pending_review: false }).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-models"] }); toast.success("Model verified"); },
  });

  const deleteModel = useMutation({
    mutationFn: async (id: string) => { await supabase.from("models").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-models"] }); toast.success("Model deleted"); },
  });

  const deleteBrand = useMutation({
    mutationFn: async (id: string) => { await supabase.from("brands").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-brands"] }); toast.success("Brand deleted"); },
  });

  const runSeed = async () => {
    toast.info("Starting catalog seed...");
    const { error } = await supabase.functions.invoke("seed-brand-catalog", {});
    if (error) toast.error(error.message); else toast.success("Seed complete");
    qc.invalidateQueries({ queryKey: ["admin-models"] });
  };

  const runDiscover = async () => {
    toast.info("Discovering new shoes...");
    const { error } = await supabase.functions.invoke("discover-new-shoes", {});
    if (error) toast.error(error.message); else toast.success("Discovery complete");
    qc.invalidateQueries({ queryKey: ["admin-models"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display tracking-wider uppercase">Catalog</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runSeed} className="rounded-none gap-2"><Sparkles className="w-4 h-4" /> Seed Brands</Button>
          <Button variant="outline" onClick={runDiscover} className="rounded-none gap-2"><RefreshCw className="w-4 h-4" /> Discover</Button>
        </div>
      </div>

      <Input placeholder="Search models or brands..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md rounded-none" />

      <Tabs defaultValue="models">
        <TabsList className="rounded-none">
          <TabsTrigger value="models" className="rounded-none">Models ({models?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="brands" className="rounded-none">Brands ({brands?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <Card className="rounded-none border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models?.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.brands?.name ?? "—"}</TableCell>
                    <TableCell>{m.category}</TableCell>
                    <TableCell>
                      {m.verified ? <Badge className="rounded-none">Verified</Badge> :
                        m.pending_review ? <Badge variant="secondary" className="rounded-none">Pending</Badge> :
                        <Badge variant="outline" className="rounded-none">Unverified</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {!m.verified && (
                        <Button size="sm" variant="ghost" onClick={() => verifyModel.mutate(m.id)} className="h-8">
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${m.name}?`)) deleteModel.mutate(m.id); }} className="h-8 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="brands">
          <Card className="rounded-none border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands?.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.country ?? "—"}</TableCell>
                    <TableCell className="truncate max-w-xs">{b.website ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${b.name}?`)) deleteBrand.mutate(b.id); }} className="h-8 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
