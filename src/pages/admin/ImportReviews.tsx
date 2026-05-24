import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileSpreadsheet } from "lucide-react";

type ProductRow = {
  brand?: string;
  model?: string;
  category?: string;
  release_year?: number | string;
  msrp?: number | string;
  weight_g?: number | string;
  drop_mm?: number | string;
  stack_height_mm?: number | string;
  verified?: string | boolean;
  source?: string;
  image_url?: string;
  canonical_model?: string;
  website?: string;
};

type ReviewRow = {
  brand?: string;
  model?: string;
  category?: string;
  persona?: string;
  language?: string;
  review_text?: string;
  key_pros?: string;
  key_cons?: string;
  recommended_for?: string;
  sources?: string;
};

const ALLOWED_CATEGORIES = new Set([
  "road",
  "trail",
  "race",
  "track",
  "lifestyle",
  "hiking",
  "approach",
]);

const norm = (s?: string) => (s || "").trim();
const truthy = (v: any) =>
  v === true || v === "t" || v === "true" || v === 1 || v === "1" || v === "yes";
const num = (v: any) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function ImportReviews() {
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<{
    brands: number;
    models: number;
    reviews: number;
    skipped: number;
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

      const productsSheet =
        wb.Sheets["Sample Products"] || wb.Sheets[wb.SheetNames[0]];
      const reviewsSheet =
        wb.Sheets["Generated Reviews"] || wb.Sheets[wb.SheetNames[1]];

      const products: ProductRow[] = productsSheet
        ? XLSX.utils.sheet_to_json(productsSheet, { defval: "" })
        : [];
      const reviews: ReviewRow[] = reviewsSheet
        ? XLSX.utils.sheet_to_json(reviewsSheet, { defval: "" })
        : [];

      addLog(`Parsed ${products.length} products and ${reviews.length} reviews.`);

      // 1) Upsert brands
      const brandNames = Array.from(
        new Set(
          [...products.map((p) => norm(p.brand)), ...reviews.map((r) => norm(r.brand))]
            .filter(Boolean),
        ),
      );

      const brandIdByName = new Map<string, string>();
      const { data: existingBrands } = await supabase
        .from("brands")
        .select("id,name")
        .in("name", brandNames);
      existingBrands?.forEach((b) => brandIdByName.set(b.name, b.id));

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
        inserted?.forEach((b) => brandIdByName.set(b.name, b.id));
        addLog(`Created ${inserted?.length ?? 0} new brands.`);
      } else {
        addLog(`All ${brandNames.length} brands already exist.`);
      }
      setProgress(20);

      // 2) Upsert models
      const modelKey = (brand: string, model: string) =>
        `${brand.toLowerCase()}::${model.toLowerCase()}`;
      const modelIdByKey = new Map<string, string>();

      // Fetch existing models for these brands
      const brandIds = Array.from(brandIdByName.values());
      if (brandIds.length) {
        const { data: existingModels } = await supabase
          .from("models")
          .select("id,name,brand_id")
          .in("brand_id", brandIds);
        const brandNameById = new Map<string, string>();
        brandIdByName.forEach((id, name) => brandNameById.set(id, name));
        existingModels?.forEach((m) => {
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
          brand_id,
          name: model,
          category: ALLOWED_CATEGORIES.has(cat) ? cat : "road",
          release_year: num(p.release_year),
          msrp: num(p.msrp),
          weight_g: num(p.weight_g),
          drop_mm: num(p.drop_mm),
          stack_height_mm: num(p.stack_height_mm),
          verified: truthy(p.verified),
          source: norm(p.source) || null,
          image_url: norm(p.image_url) || null,
        });
      });

      if (newModels.length) {
        // chunk to be safe
        const chunkSize = 100;
        for (let i = 0; i < newModels.length; i += chunkSize) {
          const chunk = newModels.slice(i, i + chunkSize);
          const { data: inserted, error } = await supabase
            .from("models")
            .insert(chunk)
            .select("id,name,brand_id");
          if (error) throw error;
          const brandNameById = new Map<string, string>();
          brandIdByName.forEach((id, name) => brandNameById.set(id, name));
          inserted?.forEach((m) => {
            const bname = brandNameById.get(m.brand_id);
            if (bname) modelIdByKey.set(modelKey(bname, m.name), m.id);
          });
        }
        addLog(`Created ${newModels.length} new models.`);
      } else {
        addLog(`No new models to create.`);
      }
      setProgress(50);

      // 3) Insert reviews
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
        if (!brand || !model || !text) {
          skipped++;
          return;
        }
        const model_id = modelIdByKey.get(modelKey(brand, model));
        if (!model_id) {
          skipped++;
          return;
        }
        const parts: string[] = [text];
        const pros = norm(r.key_pros);
        const cons = norm(r.key_cons);
        const reco = norm(r.recommended_for);
        const persona = norm(r.persona);
        const lang = norm(r.language);
        const sources = norm(r.sources);
        if (pros) parts.push(`\n\nPros: ${pros}`);
        if (cons) parts.push(`Cons: ${cons}`);
        if (reco) parts.push(`Recommended for: ${reco}`);
        if (persona || lang) parts.push(`\n[${[persona, lang].filter(Boolean).join(" · ")}]`);
        if (sources) parts.push(`\nSources: ${sources}`);

        toInsert.push({
          model_id,
          content: parts.join("\n"),
          is_guest: true,
          guest_session_id: sessionTag,
          media_urls: [],
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

      addLog(`Inserted ${inserted} reviews. Skipped ${skipped} (missing brand/model/text).`);
      setSummary({
        brands: brandNames.length,
        models: modelIdByKey.size,
        reviews: inserted,
        skipped,
      });
      setProgress(100);
      toast.success(`Imported ${inserted} reviews`);
    } catch (e: any) {
      console.error(e);
      addLog(`ERROR: ${e?.message || String(e)}`);
      toast.error(e?.message || "Import failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-wider">Import Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload an Excel file with two sheets: <code>Sample Products</code> and{" "}
          <code>Generated Reviews</code>. Brands and models are created automatically.
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
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
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
          <CardHeader>
            <CardTitle>Log</CardTitle>
          </CardHeader>
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
