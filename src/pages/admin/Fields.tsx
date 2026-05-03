import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

function TagsManager() {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("vibe");

  const { data: tags } = useQuery({
    queryKey: ["admin-tags"],
    queryFn: async () => (await supabase.from("tags").select("*").order("type").order("sort_order")).data ?? [],
  });

  const grouped = (tags ?? []).reduce((acc: Record<string, any[]>, t: any) => {
    (acc[t.type] = acc[t.type] || []).push(t); return acc;
  }, {});

  const add = useMutation({
    mutationFn: async () => {
      if (!newLabel.trim()) return;
      await supabase.from("tags").insert({ label: newLabel.trim(), type: newType as any });
    },
    onSuccess: () => { setNewLabel(""); qc.invalidateQueries({ queryKey: ["admin-tags"] }); toast.success("Tag added"); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: any) => { await supabase.from("tags").update({ active }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tags"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("tags").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tags"] }); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 rounded-none border-border flex gap-2 flex-wrap">
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New tag label" className="max-w-xs rounded-none" />
        <select value={newType} onChange={(e) => setNewType(e.target.value)} className="border border-input bg-background px-3 text-sm">
          <option value="vibe">vibe</option>
          <option value="surface">surface</option>
          <option value="use">use</option>
          <option value="feature">feature</option>
        </select>
        <Button onClick={() => add.mutate()} className="rounded-none gap-1"><Plus className="w-4 h-4" /> Add</Button>
      </Card>

      {Object.entries(grouped).map(([type, list]) => (
        <Card key={type} className="p-4 rounded-none border-border">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{type}</h3>
          <div className="space-y-2">
            {list.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
                <span className="text-sm">{t.label}</span>
                <div className="flex items-center gap-3">
                  <Switch checked={t.active} onCheckedChange={(v) => toggleActive.mutate({ id: t.id, active: v })} />
                  <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => { if (confirm(`Delete ${t.label}?`)) del.mutate(t.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function FieldOptionsManager() {
  const qc = useQueryClient();
  const [newField, setNewField] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const { data: opts } = useQuery({
    queryKey: ["admin-field-options"],
    queryFn: async () => (await supabase.from("field_options").select("*").order("field_name").order("sort_order")).data ?? [],
  });

  const grouped = (opts ?? []).reduce((acc: Record<string, any[]>, o: any) => {
    (acc[o.field_name] = acc[o.field_name] || []).push(o); return acc;
  }, {});

  const add = useMutation({
    mutationFn: async () => {
      if (!newField.trim() || !newLabel.trim()) return;
      await supabase.from("field_options").insert({
        field_name: newField.trim(), label: newLabel.trim(), value: (newValue || newLabel).trim(),
      });
    },
    onSuccess: () => { setNewField(""); setNewLabel(""); setNewValue(""); qc.invalidateQueries({ queryKey: ["admin-field-options"] }); toast.success("Option added"); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: any) => { await supabase.from("field_options").update({ active }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-field-options"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("field_options").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-field-options"] }); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 rounded-none border-border flex gap-2 flex-wrap">
        <Input value={newField} onChange={(e) => setNewField(e.target.value)} placeholder="Field name (e.g. terrain)" className="max-w-xs rounded-none" />
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label" className="max-w-xs rounded-none" />
        <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value (optional)" className="max-w-xs rounded-none" />
        <Button onClick={() => add.mutate()} className="rounded-none gap-1"><Plus className="w-4 h-4" /> Add</Button>
      </Card>

      {Object.entries(grouped).map(([field, list]) => (
        <Card key={field} className="p-4 rounded-none border-border">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{field}</h3>
          <div className="space-y-2">
            {list.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
                <span className="text-sm">{o.label} <span className="text-muted-foreground text-xs">({o.value})</span></span>
                <div className="flex items-center gap-3">
                  <Switch checked={o.active} onCheckedChange={(v) => toggleActive.mutate({ id: o.id, active: v })} />
                  <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => { if (confirm(`Delete ${o.label}?`)) del.mutate(o.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AdminFields() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display tracking-wider uppercase">Fields & Tags</h1>
      <Tabs defaultValue="tags">
        <TabsList className="rounded-none">
          <TabsTrigger value="tags" className="rounded-none">Tags</TabsTrigger>
          <TabsTrigger value="fields" className="rounded-none">Field Options</TabsTrigger>
        </TabsList>
        <TabsContent value="tags"><TagsManager /></TabsContent>
        <TabsContent value="fields"><FieldOptionsManager /></TabsContent>
      </Tabs>
    </div>
  );
}
