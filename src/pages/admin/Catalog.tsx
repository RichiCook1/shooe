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
import { Trash2, CheckCircle2, RefreshCw, Sparkles, Image as ImageIcon, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CatalogIO } from "@/components/admin/CatalogIO";

const PAGE_SIZE = 50;

export default function AdminCatalog() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unverified" | "missing_image" | "pending" | "user_submitted">("all");
  const [brandFilter, setBrandFilter] = useState<{ id: string; name: string } | null>(null);
  const [tab, setTab] = useState("models");
  const [modelsPage, setModelsPage] = useState(0);
  const [brandsPage, setBrandsPage] = useState(0);

  // Add brand dialog
  const [brandOpen, setBrandOpen] = useState(false);
  const [newBrand, setNewBrand] = useState({ name: "", country: "", website: "" });

  // Add model dialog
  const [modelOpen, setModelOpen] = useState(false);
  const [newModel, setNewModel] = useState({ name: "", brand_id: "", category: "road", image_url: "" });

  const { data: brandsResult } = useQuery({
    queryKey: ["admin-brands", search, brandsPage],
    queryFn: async () => {
      let q = supabase.from("brands").select("*", { count: "exact" }).order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, count } = await q.range(brandsPage * PAGE_SIZE, brandsPage * PAGE_SIZE + PAGE_SIZE - 1);
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  const brands = brandsResult?.rows ?? [];
  const brandsCount = brandsResult?.count ?? 0;

  // Unpaginated brands list for the Add Model dropdown
  const { data: allBrands } = useQuery({
    queryKey: ["admin-all-brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").order("name").limit(1000);
      return data ?? [];
    },
  });

  const { data: modelsResult } = useQuery({
    queryKey: ["admin-models", search, filter, brandFilter?.id, modelsPage],
    queryFn: async () => {
      let q = supabase.from("models").select("*, brands(name)", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.ilike("name", `%${search}%`);
      if (filter === "unverified") q = q.eq("verified", false);
      if (filter === "missing_image") q = q.is("image_url", null);
      if (filter === "pending") q = q.eq("pending_review", true);
      if (filter === "user_submitted") q = q.eq("source", "user_submitted");
      if (brandFilter) q = q.eq("brand_id", brandFilter.id);
      const { data, count } = await q.range(modelsPage * PAGE_SIZE, modelsPage * PAGE_SIZE + PAGE_SIZE - 1);
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  const models = modelsResult?.rows ?? [];
  const modelsCount = modelsResult?.count ?? 0;
  const modelsTotalPages = Math.max(1, Math.ceil(modelsCount / PAGE_SIZE));
  const brandsTotalPages = Math.max(1, Math.ceil(brandsCount / PAGE_SIZE));

  const selectBrand = (b: { id: string; name: string }) => {
    setBrandFilter(b);
    setTab("models");
  };

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

  const addBrand = useMutation({
    mutationFn: async () => {
      if (!newBrand.name.trim()) throw new Error("Brand name required");
      const { error } = await supabase.from("brands").insert({
        name: newBrand.name.trim(),
        country: newBrand.country.trim() || null,
        website: newBrand.website.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      toast.success("Brand added");
      setBrandOpen(false);
      setNewBrand({ name: "", country: "", website: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addModel = useMutation({
    mutationFn: async () => {
      if (!newModel.name.trim()) throw new Error("Model name required");
      if (!newModel.brand_id) throw new Error("Brand required");
      const { error } = await supabase.from("models").insert({
        name: newModel.name.trim(),
        brand_id: newModel.brand_id,
        category: newModel.category as any,
        image_url: newModel.image_url.trim() || null,
        verified: true,
        pending_review: false,
        source: "admin",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-models"] });
      toast.success("Model added");
      setModelOpen(false);
      setNewModel({ name: "", brand_id: "", category: "road", image_url: "" });
    },
    onError: (e: any) => toast.error(e.message),
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
        <div className="flex gap-2 flex-wrap">
          <Dialog open={modelOpen} onOpenChange={setModelOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-none gap-2"><Plus className="w-4 h-4" /> Add Model</Button>
            </DialogTrigger>
            <DialogContent className="rounded-none">
              <DialogHeader><DialogTitle>Add Model</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Brand</Label>
                  <Select value={newModel.brand_id} onValueChange={(v) => setNewModel({ ...newModel, brand_id: v })}>
                    <SelectTrigger className="rounded-none"><SelectValue placeholder="Select brand" /></SelectTrigger>
                    <SelectContent>
                      {allBrands?.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input className="rounded-none" value={newModel.name} onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} placeholder="e.g. Pegasus 41" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={newModel.category} onValueChange={(v) => setNewModel({ ...newModel, category: v })}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="road">Road</SelectItem>
                      <SelectItem value="trail">Trail</SelectItem>
                      <SelectItem value="racing">Racing</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="hiking">Hiking</SelectItem>
                      <SelectItem value="lifestyle">Lifestyle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Image URL (optional)</Label>
                  <Input className="rounded-none" value={newModel.image_url} onChange={(e) => setNewModel({ ...newModel, image_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => addModel.mutate()} disabled={addModel.isPending} className="rounded-none">Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={brandOpen} onOpenChange={setBrandOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-none gap-2"><Plus className="w-4 h-4" /> Add Brand</Button>
            </DialogTrigger>
            <DialogContent className="rounded-none">
              <DialogHeader><DialogTitle>Add Brand</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input className="rounded-none" value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} placeholder="e.g. On Running" />
                </div>
                <div>
                  <Label>Country (optional)</Label>
                  <Input className="rounded-none" value={newBrand.country} onChange={(e) => setNewBrand({ ...newBrand, country: e.target.value })} />
                </div>
                <div>
                  <Label>Website (optional)</Label>
                  <Input className="rounded-none" value={newBrand.website} onChange={(e) => setNewBrand({ ...newBrand, website: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => addBrand.mutate()} disabled={addBrand.isPending} className="rounded-none">Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <CatalogIO />
          <Button variant="outline" onClick={runSeed} className="rounded-none gap-2"><Sparkles className="w-4 h-4" /> Seed Brands</Button>
          <Button variant="outline" onClick={runDiscover} className="rounded-none gap-2"><RefreshCw className="w-4 h-4" /> Discover</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search models or brands..." value={search} onChange={(e) => { setSearch(e.target.value); setModelsPage(0); setBrandsPage(0); }} className="max-w-md rounded-none" />
        <Select value={filter} onValueChange={(v: any) => { setFilter(v); setModelsPage(0); }}>
          <SelectTrigger className="w-48 rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
            <SelectItem value="missing_image">Missing image</SelectItem>
            <SelectItem value="pending">Pending review</SelectItem>
            <SelectItem value="user_submitted">User submitted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {brandFilter && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtering by brand:</span>
          <Badge className="rounded-none gap-1">
            {brandFilter.name}
            <button onClick={() => setBrandFilter(null)} className="ml-1 hover:opacity-70">×</button>
          </Badge>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-none">
          <TabsTrigger value="models" className="rounded-none">Models ({modelsCount})</TabsTrigger>
          <TabsTrigger value="brands" className="rounded-none">Brands ({brandsCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <Card className="rounded-none border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Image</TableHead>
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
                    <TableCell>
                      {m.image_url ? (
                        <img src={m.image_url} alt="" className="w-10 h-10 object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-muted flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>
                      {m.brands?.name ? (
                        <button
                          onClick={() => selectBrand({ id: m.brand_id, name: m.brands.name })}
                          className="hover:underline text-left"
                        >
                          {m.brands.name}
                        </button>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{m.category}</TableCell>
                    <TableCell>
                      {m.verified ? <Badge className="rounded-none">Verified</Badge> :
                        m.pending_review ? <Badge variant="secondary" className="rounded-none">Pending</Badge> :
                        <Badge variant="outline" className="rounded-none">Unverified</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => enrichOne.mutate(m.id)} className="h-8" title="Fetch image">
                        <ImageIcon className="w-4 h-4" />
                      </Button>
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
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-muted-foreground">
              {modelsCount === 0 ? "No results" : `Showing ${modelsPage * PAGE_SIZE + 1}–${Math.min((modelsPage + 1) * PAGE_SIZE, modelsCount)} of ${modelsCount}`}
            </span>
            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" className="rounded-none" disabled={modelsPage === 0} onClick={() => setModelsPage(p => Math.max(0, p - 1))}>Prev</Button>
              <span className="text-muted-foreground">Page {modelsPage + 1} / {modelsTotalPages}</span>
              <Button variant="outline" size="sm" className="rounded-none" disabled={modelsPage + 1 >= modelsTotalPages} onClick={() => setModelsPage(p => p + 1)}>Next</Button>
            </div>
          </div>
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
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => selectBrand({ id: b.id, name: b.name })}>
                    <TableCell className="font-medium hover:underline">{b.name}</TableCell>
                    <TableCell>{b.country ?? "—"}</TableCell>
                    <TableCell className="truncate max-w-xs">{b.website ?? "—"}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${b.name}?`)) deleteBrand.mutate(b.id); }} className="h-8 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-muted-foreground">
              {brandsCount === 0 ? "No results" : `Showing ${brandsPage * PAGE_SIZE + 1}–${Math.min((brandsPage + 1) * PAGE_SIZE, brandsCount)} of ${brandsCount}`}
            </span>
            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" className="rounded-none" disabled={brandsPage === 0} onClick={() => setBrandsPage(p => Math.max(0, p - 1))}>Prev</Button>
              <span className="text-muted-foreground">Page {brandsPage + 1} / {brandsTotalPages}</span>
              <Button variant="outline" size="sm" className="rounded-none" disabled={brandsPage + 1 >= brandsTotalPages} onClick={() => setBrandsPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
