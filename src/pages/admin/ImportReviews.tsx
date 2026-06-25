import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, ImageIcon, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const ALLOWED_CATEGORIES = new Set([
  "road", "trail", "race", "track", "lifestyle", "hiking", "approach",
]);

const KNOWN_BRANDS = [
  "New Balance", "La Sportiva", "Under Armour", "On Running",
  "Adidas", "Hoka", "Nike", "Asics", "Saucony", "Brooks", "On",
  "Puma", "Mizuno", "Altra", "Topo", "Salomon", "Merrell", "Reebok",
  "Skechers", "Diadora", "Craft", "Inov-8", "Inov8", "Scarpa", "Norda",
  "Tracksmith", "Newton", "Karhu", "361", "Atreyu", "Anta", "Xtep",
  "Decathlon", "Kiprun", "VJ", "Speedland", "NNormal", "Soar", "Satisfy",
];

const norm = (s?: any) => (s == null ? "" : String(s).trim());
const num = (v: any) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const firstNumber = (s: string): number | null => {
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

function parseWeight(s: string): number | null {
  if (!s) return null;
  // Prefer grams inside parentheses, e.g. "8.7 oz (248 g)"
  const g = s.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (g) return Math.round(Number(g[1]));
  const oz = s.match(/(\d+(?:\.\d+)?)\s*oz\b/i);
  if (oz) return Math.round(Number(oz[1]) * 28.3495);
  const n = firstNumber(s);
  return n != null ? Math.round(n) : null;
}

function parsePrice(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/,/g, "");
  return firstNumber(cleaned);
}

function splitBrandModel(full: string): { brand: string; model: string } | null {
  const t = norm(full);
  if (!t) return null;
  const lower = t.toLowerCase();
  // longest known brand prefix
  const sorted = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
  for (const b of sorted) {
    const bl = b.toLowerCase();
    if (lower === bl) return { brand: b, model: t };
    if (lower.startsWith(bl + " ")) {
      return { brand: b, model: t.slice(b.length + 1).trim() };
    }
  }
  // fallback: first token
  const parts = t.split(/\s+/);
  if (parts.length < 2) return { brand: parts[0], model: parts[0] };
  return { brand: parts[0], model: parts.slice(1).join(" ") };
}

type MergedRow = Record<string, any>;

export default function ImportReviews() {
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<{
    brands: number; models: number; reviews: number; skipped: number;
  } | null>(null);

  const addLog = (msg: string) => setLog((p) => [...p, msg]);

  const run = async () => {
    if (!file) return;
    setRunning(true);
    setLog([]);
    setSummary(null);
    setProgress(0);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      // Detect merged single-sheet format
      let mergedSheetName: string | null = null;
      for (const name of wb.SheetNames) {
        const sample: MergedRow[] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
        if (sample.length > 0) {
          const keys = Object.keys(sample[0]).map((k) => k.toLowerCase());
          if (
            keys.some((k) => k.includes("shoe model")) &&
            keys.some((k) => k.includes("detailed review") || k.includes("review summary") || k === "review" || k.includes("review text"))
          ) {
            mergedSheetName = name;
            break;
          }
        }
      }

      if (mergedSheetName) {
        addLog(`Detected merged review format in sheet "${mergedSheetName}".`);
        await runMerged(wb.Sheets[mergedSheetName]);
      } else {
        await runTwoSheet(wb);
      }
    } catch (e: any) {
      console.error(e);
      addLog(`ERROR: ${e?.message || String(e)}`);
      toast.error(e?.message || "Import failed");
    } finally {
      setRunning(false);
    }
  };

  const getKey = (row: MergedRow, ...needles: string[]): string => {
    const keys = Object.keys(row);
    for (const n of needles) {
      const k = keys.find((kk) => kk.toLowerCase().includes(n.toLowerCase()));
      if (k) return norm(row[k]);
    }
    return "";
  };

  const runMerged = async (sheet: XLSX.WorkSheet) => {
    const rows: MergedRow[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    addLog(`Parsed ${rows.length} rows.`);

    // 1) Group: derive brand/model per row
    type Parsed = {
      brand: string;
      model: string;
      reviewer: string;
      reviewText: string;
      weight_g: number | null;
      stack_height_mm: number | null;
      drop_mm: number | null;
      msrp: number | null;
      midsole: string;
      keyFeatures: string;
      useCase: string;
      sentiment: string;
      source: string;
    };
    const parsed: Parsed[] = [];
    let skipped = 0;
    for (const r of rows) {
      const shoe = getKey(r, "shoe model", "model");
      const text = getKey(r, "detailed review", "review summary", "review text", "review");
      if (!shoe || !text) { skipped++; continue; }
      const bm = splitBrandModel(shoe);
      if (!bm || !bm.brand || !bm.model) { skipped++; continue; }
      parsed.push({
        brand: bm.brand,
        model: bm.model,
        reviewer: getKey(r, "reviewer"),
        reviewText: text,
        weight_g: parseWeight(getKey(r, "weight")),
        stack_height_mm: firstNumber(getKey(r, "stack")),
        drop_mm: firstNumber(getKey(r, "drop")),
        msrp: parsePrice(getKey(r, "price", "msrp")),
        midsole: getKey(r, "midsole", "foam"),
        keyFeatures: getKey(r, "key features", "features"),
        useCase: getKey(r, "intended use", "use case", "category"),
        sentiment: getKey(r, "sentiment"),
        source: getKey(r, "source", "sources"),
      });
    }
    addLog(`Valid rows: ${parsed.length}. Skipped: ${skipped}.`);

    // 2) Upsert brands
    const brandNames = Array.from(new Set(parsed.map((p) => p.brand)));
    const brandIdByName = new Map<string, string>();
    const { data: existingBrands } = await supabase
      .from("brands").select("id,name").in("name", brandNames);
    existingBrands?.forEach((b: any) => brandIdByName.set(b.name, b.id));

    const newBrands = brandNames.filter((n) => !brandIdByName.has(n));
    if (newBrands.length) {
      const { data: inserted, error } = await supabase
        .from("brands")
        .insert(newBrands.map((name) => ({ name })))
        .select("id,name");
      if (error) throw error;
      inserted?.forEach((b: any) => brandIdByName.set(b.name, b.id));
      addLog(`Created ${inserted?.length ?? 0} brands.`);
    } else {
      addLog(`All ${brandNames.length} brands already exist.`);
    }
    setProgress(20);

    // 3) Upsert models
    const modelKey = (brand: string, model: string) =>
      `${brand.toLowerCase()}::${model.toLowerCase()}`;
    const modelIdByKey = new Map<string, string>();
    const brandIds = Array.from(brandIdByName.values());
    const brandNameById = new Map<string, string>();
    brandIdByName.forEach((id, name) => brandNameById.set(id, name));

    if (brandIds.length) {
      const { data: existingModels } = await supabase
        .from("models")
        .select("id,name,brand_id,weight_g,stack_height_mm,drop_mm,msrp")
        .in("brand_id", brandIds);
      existingModels?.forEach((m: any) => {
        const bname = brandNameById.get(m.brand_id);
        if (bname) modelIdByKey.set(modelKey(bname, m.name), m.id);
      });

      // Patch existing models with missing specs (only fill nulls)
      const patchOps: Promise<any>[] = [];
      const seen = new Set<string>();
      for (const p of parsed) {
        const k = modelKey(p.brand, p.model);
        if (seen.has(k)) continue;
        seen.add(k);
        const existing: any = existingModels?.find((m: any) => {
          const bname = brandNameById.get(m.brand_id);
          return bname && modelKey(bname, m.name) === k;
        });
        if (!existing) continue;
        const patch: any = {};
        if (existing.weight_g == null && p.weight_g != null) patch.weight_g = p.weight_g;
        if (existing.stack_height_mm == null && p.stack_height_mm != null) patch.stack_height_mm = p.stack_height_mm;
        if (existing.drop_mm == null && p.drop_mm != null) patch.drop_mm = p.drop_mm;
        if (existing.msrp == null && p.msrp != null) patch.msrp = p.msrp;
        if (Object.keys(patch).length) {
          patchOps.push(Promise.resolve(supabase.from("models").update(patch).eq("id", existing.id)));
        }
      }
      if (patchOps.length) {
        await Promise.all(patchOps);
        addLog(`Patched specs on ${patchOps.length} existing models.`);
      }
    }

    // Create new models
    const newModels: any[] = [];
    const seenNew = new Set<string>();
    for (const p of parsed) {
      const k = modelKey(p.brand, p.model);
      if (modelIdByKey.has(k) || seenNew.has(k)) continue;
      seenNew.add(k);
      const brand_id = brandIdByName.get(p.brand);
      if (!brand_id) continue;
      newModels.push({
        brand_id,
        name: p.model,
        category: "road",
        weight_g: p.weight_g,
        stack_height_mm: p.stack_height_mm,
        drop_mm: p.drop_mm,
        msrp: p.msrp,
        verified: false,
        source: "kofuzi-import",
      });
    }
    if (newModels.length) {
      const chunkSize = 100;
      for (let i = 0; i < newModels.length; i += chunkSize) {
        const chunk = newModels.slice(i, i + chunkSize);
        const { data: inserted, error } = await supabase
          .from("models").insert(chunk).select("id,name,brand_id");
        if (error) throw error;
        inserted?.forEach((m: any) => {
          const bname = brandNameById.get(m.brand_id);
          if (bname) modelIdByKey.set(modelKey(bname, m.name), m.id);
        });
      }
      addLog(`Created ${newModels.length} models.`);
    } else {
      addLog(`No new models to create.`);
    }
    setProgress(55);

    // 4) Reviews
    const { data: userData } = await supabase.auth.getUser();
    const adminId = userData.user?.id || "anonymous";
    const sessionTag = `import:${adminId}:${crypto.randomUUID()}`;

    const toInsert: any[] = [];
    for (const p of parsed) {
      const model_id = modelIdByKey.get(modelKey(p.brand, p.model));
      if (!model_id) { skipped++; continue; }
      const parts: string[] = [p.reviewText];
      const meta: string[] = [];
      if (p.keyFeatures) meta.push(`Key features: ${p.keyFeatures}`);
      if (p.useCase) meta.push(`Best for: ${p.useCase}`);
      if (p.midsole) meta.push(`Midsole: ${p.midsole}`);
      const specBits: string[] = [];
      if (p.weight_g) specBits.push(`${p.weight_g}g`);
      if (p.stack_height_mm) specBits.push(`${p.stack_height_mm}mm stack`);
      if (p.drop_mm != null) specBits.push(`${p.drop_mm}mm drop`);
      if (p.msrp) specBits.push(`$${p.msrp}`);
      if (specBits.length) meta.push(`Specs: ${specBits.join(" · ")}`);
      if (meta.length) parts.push("\n" + meta.join("\n"));
      const tagBits: string[] = [];
      if (p.reviewer) tagBits.push(`Reviewer: ${p.reviewer}`);
      if (p.sentiment) tagBits.push(`Sentiment: ${p.sentiment}`);
      if (tagBits.length) parts.push(`\n[${tagBits.join(" · ")}]`);
      if (p.source) parts.push(`Sources: ${p.source}`);

      toInsert.push({
        model_id,
        content: parts.join("\n"),
        is_guest: true,
        guest_session_id: sessionTag,
        media_urls: [],
      });
    }

    let inserted = 0;
    const chunkSize = 200;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from("reviews").insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
      setProgress(55 + Math.round(((i + chunk.length) / toInsert.length) * 45));
    }

    addLog(`Inserted ${inserted} reviews. Skipped ${skipped}.`);
    setSummary({
      brands: brandNames.length,
      models: modelIdByKey.size,
      reviews: inserted,
      skipped,
    });
    setProgress(100);
    toast.success(`Imported ${inserted} reviews`);
  };

  const runTwoSheet = async (wb: XLSX.WorkBook) => {
    const productsSheet = wb.Sheets["Sample Products"] || wb.Sheets[wb.SheetNames[0]];
    const reviewsSheet = wb.Sheets["Generated Reviews"] || wb.Sheets[wb.SheetNames[1]];

    const products: any[] = productsSheet ? XLSX.utils.sheet_to_json(productsSheet, { defval: "" }) : [];
    const reviews: any[] = reviewsSheet ? XLSX.utils.sheet_to_json(reviewsSheet, { defval: "" }) : [];

    addLog(`Parsed ${products.length} products and ${reviews.length} reviews.`);

    const brandNames = Array.from(new Set(
      [...products.map((p) => norm(p.brand)), ...reviews.map((r) => norm(r.brand))].filter(Boolean),
    ));

    const brandIdByName = new Map<string, string>();
    const { data: existingBrands } = await supabase
      .from("brands").select("id,name").in("name", brandNames);
    existingBrands?.forEach((b: any) => brandIdByName.set(b.name, b.id));

    const newBrands = brandNames.filter((n) => !brandIdByName.has(n));
    if (newBrands.length) {
      const brandWebsite = new Map<string, string>();
      products.forEach((p) => {
        const n = norm(p.brand);
        const w = norm(p.website);
        if (n && w && !brandWebsite.has(n)) brandWebsite.set(n, w);
      });
      const { data: inserted, error } = await supabase
        .from("brands")
        .insert(newBrands.map((name) => ({ name, website: brandWebsite.get(name) || null })))
        .select("id,name");
      if (error) throw error;
      inserted?.forEach((b: any) => brandIdByName.set(b.name, b.id));
      addLog(`Created ${inserted?.length ?? 0} new brands.`);
    }
    setProgress(20);

    const modelKey = (brand: string, model: string) =>
      `${brand.toLowerCase()}::${model.toLowerCase()}`;
    const modelIdByKey = new Map<string, string>();
    const brandIds = Array.from(brandIdByName.values());
    if (brandIds.length) {
      const { data: existingModels } = await supabase
        .from("models").select("id,name,brand_id").in("brand_id", brandIds);
      const brandNameById = new Map<string, string>();
      brandIdByName.forEach((id, name) => brandNameById.set(id, name));
      existingModels?.forEach((m: any) => {
        const bname = brandNameById.get(m.brand_id);
        if (bname) modelIdByKey.set(modelKey(bname, m.name), m.id);
      });
    }

    const newModels: any[] = [];
    products.forEach((p) => {
      const brand = norm(p.brand);
      const model = norm(p.model);
      if (!brand || !model) return;
      const k = modelKey(brand, model);
      if (modelIdByKey.has(k)) return;
      const brand_id = brandIdByName.get(brand);
      if (!brand_id) return;
      const cat = norm(p.category).toLowerCase();
      newModels.push({
        brand_id, name: model,
        category: ALLOWED_CATEGORIES.has(cat) ? cat : "road",
        release_year: num(p.release_year),
        msrp: num(p.msrp),
        weight_g: num(p.weight_g),
        drop_mm: num(p.drop_mm),
        stack_height_mm: num(p.stack_height_mm),
        verified: !!p.verified,
        source: norm(p.source) || null,
        image_url: norm(p.image_url) || null,
      });
    });

    if (newModels.length) {
      const chunkSize = 100;
      for (let i = 0; i < newModels.length; i += chunkSize) {
        const chunk = newModels.slice(i, i + chunkSize);
        const { data: inserted, error } = await supabase
          .from("models").insert(chunk).select("id,name,brand_id");
        if (error) throw error;
        const brandNameById = new Map<string, string>();
        brandIdByName.forEach((id, name) => brandNameById.set(id, name));
        inserted?.forEach((m: any) => {
          const bname = brandNameById.get(m.brand_id);
          if (bname) modelIdByKey.set(modelKey(bname, m.name), m.id);
        });
      }
      addLog(`Created ${newModels.length} new models.`);
    }
    setProgress(50);

    const { data: userData } = await supabase.auth.getUser();
    const adminId = userData.user?.id || "anonymous";
    const sessionTag = `import:${adminId}:${crypto.randomUUID()}`;

    let inserted = 0;
    let skipped = 0;
    const toInsert: any[] = [];

    reviews.forEach((r) => {
      const brand = norm(r.brand);
      const model = norm(r.model);
      const text = norm(r.review_text);
      if (!brand || !model || !text) { skipped++; return; }
      const model_id = modelIdByKey.get(modelKey(brand, model));
      if (!model_id) { skipped++; return; }
      const parts: string[] = [text];
      const pros = norm(r.key_pros), cons = norm(r.key_cons), reco = norm(r.recommended_for);
      const persona = norm(r.persona), lang = norm(r.language), sources = norm(r.sources);
      if (pros) parts.push(`\n\nPros: ${pros}`);
      if (cons) parts.push(`Cons: ${cons}`);
      if (reco) parts.push(`Recommended for: ${reco}`);
      if (persona || lang) parts.push(`\n[${[persona, lang].filter(Boolean).join(" · ")}]`);
      if (sources) parts.push(`\nSources: ${sources}`);
      toInsert.push({
        model_id, content: parts.join("\n"),
        is_guest: true, guest_session_id: sessionTag, media_urls: [],
      });
    });

    const chunkSize = 200;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from("reviews").insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
      setProgress(50 + Math.round(((i + chunk.length) / toInsert.length) * 50));
    }

    addLog(`Inserted ${inserted} reviews. Skipped ${skipped}.`);
    setSummary({ brands: brandNames.length, models: modelIdByKey.size, reviews: inserted, skipped });
    setProgress(100);
    toast.success(`Imported ${inserted} reviews`);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-wider">Import Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload an Excel file. Supports the two-sheet template (<code>Sample Products</code> + <code>Generated Reviews</code>) or a single merged sheet with columns like <code>Shoe Model</code>, <code>Detailed Review Summary</code>, <code>Weight</code>, <code>Stack Height</code>, <code>Heel Drop</code>, <code>Price</code>. Specs are attached to the created models.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Excel file
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={running}
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              {file.name} ({Math.round(file.size / 1024)} KB)
            </p>
          )}
          <Button onClick={run} disabled={!file || running} className="w-full">
            <Upload className="h-4 w-4" />
            {running ? "Importing..." : "Import"}
          </Button>
          {running && <Progress value={progress} />}
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-4 gap-4 text-center">
            <Stat label="Brands" value={summary.brands} />
            <Stat label="Models" value={summary.models} />
            <Stat label="Reviews" value={summary.reviews} />
            <Stat label="Skipped" value={summary.skipped} />
          </CardContent>
        </Card>
      )}

      {log.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Log</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
              {log.join("\n")}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="font-display text-3xl">{value}</div>
    <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
  </div>
);
