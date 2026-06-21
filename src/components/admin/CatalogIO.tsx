import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const BRAND_COLS = ["id", "name", "country", "website"] as const;
const MODEL_COLS = [
  "id", "brand_name", "name", "category", "release_year",
  "stack_height_mm", "drop_mm", "weight_g", "msrp",
  "image_url", "image_source_url", "verified", "pending_review", "source",
] as const;

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toBool(v: any): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
}
function toStr(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function CatalogIO() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const fetchAll = async <T,>(
    table: "brands" | "models",
    select: string,
    orderCol: string,
  ): Promise<T[]> => {
    const pageSize = 1000;
    const all: T[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .order(orderCol)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as T[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const exportXlsx = async () => {
    setBusy(true);
    try {
      toast.info("Building export...");
      const [brandsData, modelsData] = await Promise.all([
        fetchAll<any>("brands", "id,name,country,website", "name"),
        fetchAll<any>(
          "models",
          "id,brand_id,name,category,release_year,stack_height_mm,drop_mm,weight_g,msrp,image_url,image_source_url,verified,pending_review,source,brands(name)",
          "name",
        ),
      ]);

      const brandRows = brandsData.map((b: any) => ({
        id: b.id, name: b.name, country: b.country ?? "", website: b.website ?? "",
      }));
      const modelRows = modelsData.map((m: any) => ({
        id: m.id,
        brand_name: m.brands?.name ?? "",
        name: m.name,
        category: m.category ?? "",
        release_year: m.release_year ?? "",
        stack_height_mm: m.stack_height_mm ?? "",
        drop_mm: m.drop_mm ?? "",
        weight_g: m.weight_g ?? "",
        msrp: m.msrp ?? "",
        image_url: m.image_url ?? "",
        image_source_url: m.image_source_url ?? "",
        verified: m.verified ?? false,
        pending_review: m.pending_review ?? false,
        source: m.source ?? "",
      }));

      const wb = XLSX.utils.book_new();
      const bs = XLSX.utils.json_to_sheet(brandRows, { header: BRAND_COLS as unknown as string[] });
      const ms = XLSX.utils.json_to_sheet(modelRows, { header: MODEL_COLS as unknown as string[] });
      XLSX.utils.book_append_sheet(wb, bs, "Brands");
      XLSX.utils.book_append_sheet(wb, ms, "Models");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `catalog-${date}.xlsx`);
      toast.success(`Exported ${brandRows.length} brands, ${modelRows.length} models`);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const importXlsx = async (file: File) => {
    setBusy(true);
    try {
      toast.info("Reading file...");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const brandsSheet = wb.Sheets["Brands"];
      const modelsSheet = wb.Sheets["Models"];
      if (!brandsSheet && !modelsSheet) throw new Error('No "Brands" or "Models" sheet found');

      let brandsCreated = 0, brandsUpdated = 0, modelsCreated = 0, modelsUpdated = 0, skipped = 0;
      const errors: string[] = [];

      // --- Brands ---
      const brandRows: any[] = brandsSheet ? XLSX.utils.sheet_to_json(brandsSheet, { defval: null }) : [];
      // Cache existing brands by lowercase name
      const { data: existingBrands } = await supabase.from("brands").select("id, name");
      const byName = new Map<string, string>(
        (existingBrands ?? []).map((b: any) => [b.name.toLowerCase().trim(), b.id]),
      );

      for (const row of brandRows) {
        const name = toStr(row.name);
        if (!name) { skipped++; continue; }
        const payload = {
          name,
          country: toStr(row.country),
          website: toStr(row.website),
        };
        const id = toStr(row.id);
        if (id) {
          const { error } = await supabase.from("brands").update(payload).eq("id", id);
          if (error) { errors.push(`brand ${name}: ${error.message}`); continue; }
          brandsUpdated++;
          byName.set(name.toLowerCase(), id);
        } else {
          const existingId = byName.get(name.toLowerCase());
          if (existingId) {
            const { error } = await supabase.from("brands").update(payload).eq("id", existingId);
            if (error) { errors.push(`brand ${name}: ${error.message}`); continue; }
            brandsUpdated++;
          } else {
            const { data, error } = await supabase.from("brands").insert(payload).select("id").single();
            if (error) { errors.push(`brand ${name}: ${error.message}`); continue; }
            brandsCreated++;
            if (data?.id) byName.set(name.toLowerCase(), data.id);
          }
        }
      }

      // --- Models ---
      const modelRows: any[] = modelsSheet ? XLSX.utils.sheet_to_json(modelsSheet, { defval: null }) : [];
      // Refresh brand map after any brand inserts
      const { data: allBrands } = await supabase.from("brands").select("id, name");
      const brandIdByName = new Map<string, string>(
        (allBrands ?? []).map((b: any) => [b.name.toLowerCase().trim(), b.id]),
      );
      // Existing models keyed by brand_id + lowercase name
      const { data: existingModels } = await supabase.from("models").select("id, name, brand_id");
      const modelKey = (brandId: string, name: string) => `${brandId}::${name.toLowerCase().trim()}`;
      const existingByKey = new Map<string, string>(
        (existingModels ?? []).map((m: any) => [modelKey(m.brand_id, m.name), m.id]),
      );

      for (const row of modelRows) {
        const name = toStr(row.name);
        const brandName = toStr(row.brand_name);
        if (!name || !brandName) { skipped++; continue; }
        const brandId = brandIdByName.get(brandName.toLowerCase());
        if (!brandId) { errors.push(`model ${name}: brand "${brandName}" not found`); continue; }

        const payload: any = {
          name,
          brand_id: brandId,
          category: toStr(row.category) ?? "road",
          release_year: toNum(row.release_year),
          stack_height_mm: toNum(row.stack_height_mm),
          drop_mm: toNum(row.drop_mm),
          weight_g: toNum(row.weight_g),
          msrp: toNum(row.msrp),
          image_url: toStr(row.image_url),
          image_source_url: toStr(row.image_source_url),
          verified: toBool(row.verified) ?? false,
          pending_review: toBool(row.pending_review) ?? false,
          source: toStr(row.source) ?? "import",
        };
        const id = toStr(row.id);
        if (id) {
          const { error } = await supabase.from("models").update(payload).eq("id", id);
          if (error) { errors.push(`model ${name}: ${error.message}`); continue; }
          modelsUpdated++;
        } else {
          const existingId = existingByKey.get(modelKey(brandId, name));
          if (existingId) {
            const { error } = await supabase.from("models").update(payload).eq("id", existingId);
            if (error) { errors.push(`model ${name}: ${error.message}`); continue; }
            modelsUpdated++;
          } else {
            const { data, error } = await supabase.from("models").insert(payload).select("id").single();
            if (error) { errors.push(`model ${name}: ${error.message}`); continue; }
            modelsCreated++;
            if (data?.id) existingByKey.set(modelKey(brandId, name), data.id);
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["admin-models"] });
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      qc.invalidateQueries({ queryKey: ["admin-all-brands"] });

      const summary = `Brands: +${brandsCreated} / ~${brandsUpdated}. Models: +${modelsCreated} / ~${modelsUpdated}. Skipped: ${skipped}.`;
      if (errors.length) {
        console.error("Import errors:", errors);
        toast.warning(`${summary} ${errors.length} error(s) — see console.`);
      } else {
        toast.success(summary);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importXlsx(f); }}
      />
      <Button variant="outline" disabled={busy} onClick={exportXlsx} className="rounded-none gap-2">
        <Download className="w-4 h-4" /> Export
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="rounded-none gap-2">
        <Upload className="w-4 h-4" /> Import
      </Button>
    </>
  );
}
