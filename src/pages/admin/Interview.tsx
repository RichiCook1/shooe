import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/Combobox";
import { AudioRecorder } from "@/components/admin/AudioRecorder";
import { compressImage } from "@/lib/imageCompression";
import { ArrowLeft, ArrowRight, Camera, Check, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Step = "audio" | "photo" | "confirm" | "done";
const STEPS: Step[] = ["audio", "photo", "confirm", "done"];

const blobToBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });

export default function AdminInterview() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("audio");

  // Audio + transcript
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMime, setAudioMime] = useState<string>("audio/webm");
  const [transcript, setTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);

  // Photo
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [detecting, setDetecting] = useState(false);

  // Shoe selection
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [useCustomBrand, setUseCustomBrand] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => (await supabase.from("brands").select("*").order("name")).data ?? [],
  });
  const { data: models } = useQuery({
    queryKey: ["models", brandId],
    queryFn: async () =>
      brandId
        ? (await supabase.from("models").select("*").eq("brand_id", brandId).order("name")).data ?? []
        : [],
    enabled: !!brandId && !useCustomBrand,
  });

  const brandItems = useMemo(() => (brands ?? []).map((b: any) => ({ value: b.id, label: b.name })), [brands]);
  const modelItems = useMemo(() => (models ?? []).map((m: any) => ({ value: m.id, label: m.name })), [models]);

  const idx = STEPS.indexOf(step);

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    setTranscribing(true);
    try {
      const b64 = await blobToBase64(audioBlob);
      const { data, error } = await supabase.functions.invoke("transcribe-interview", {
        body: { audioBase64: b64, mimeType: audioMime },
      });
      if (error) throw error;
      setTranscript((data?.transcript || "").trim());
      if (!data?.transcript) toast.warning("No speech detected — try again");
      else setStep("photo");
    } catch (e: any) {
      toast.error("Transcription failed: " + (e.message || e));
    } finally {
      setTranscribing(false);
    }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const compressed = await compressImage(f);
    setPhoto(compressed);
    const preview = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = (ev) => res(ev.target?.result as string);
      r.readAsDataURL(compressed);
    });
    setPhotoPreview(preview);

    // Auto-identify
    setDetecting(true);
    try {
      const { data } = await supabase.functions.invoke("identify-shoe-from-image", {
        body: { imageBase64: preview },
      });
      if (data?.brandMatch) {
        setUseCustomBrand(false);
        setBrandId(data.brandMatch.id);
        if (data.modelMatch) {
          setUseCustomModel(false);
          setModelId(data.modelMatch.id);
          toast.success(`Detected: ${data.brandMatch.name} ${data.modelMatch.name}`);
        } else if (data.model) {
          setUseCustomModel(true);
          setCustomModel(data.model);
          toast.info(`Brand detected — confirm model: ${data.model}`);
        }
      } else if (data?.brand && data?.model) {
        setUseCustomBrand(true);
        setCustomBrand(data.brand);
        setCustomModel(data.model);
        toast.info(`Detected: ${data.brand} ${data.model} — please confirm`);
      } else {
        toast.message("Couldn't identify the shoe — pick manually");
      }
    } catch {
      // silent
    } finally {
      setDetecting(false);
    }
  };

  const canConfirm =
    !!photo &&
    (useCustomBrand ? !!customBrand && !!customModel : useCustomModel ? !!brandId && !!customModel : !!modelId);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Upload photo
      const ext = photo!.name.split(".").pop() || "jpg";
      const path = `interview/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("review-media").upload(path, photo!);
      if (upErr) throw upErr;
      const photoUrl = supabase.storage.from("review-media").getPublicUrl(path).data.publicUrl;

      // Resolve shoe model id
      let finalModelId = modelId;
      if (useCustomBrand || useCustomModel) {
        const brandName = useCustomBrand
          ? customBrand
          : brands?.find((b: any) => b.id === brandId)?.name ?? "";
        try {
          const { data: result, error: vErr } = await supabase.functions.invoke("validate-shoe-name", {
            body: { brand: brandName, model: customModel, brandId: useCustomBrand ? undefined : brandId },
          });
          if (vErr || !result?.modelId) throw vErr ?? new Error("validation failed");
          finalModelId = result.modelId;
        } catch {
          // Fallback: insert directly
          let bId: string | null = useCustomBrand ? null : brandId;
          if (useCustomBrand && customBrand) {
            const { data: existing } = await supabase.from("brands").select("id").ilike("name", customBrand).maybeSingle();
            if (existing) bId = existing.id;
            else {
              const { data: nb } = await supabase.from("brands").insert({ name: customBrand }).select().single();
              bId = nb?.id ?? null;
            }
          }
          if (bId) {
            const { data: existingM } = await supabase.from("models").select("id").eq("brand_id", bId).ilike("name", customModel).maybeSingle();
            if (existingM) finalModelId = existingM.id;
            else {
              const { data: nm } = await supabase.from("models").insert({ name: customModel, brand_id: bId, pending_review: true }).select().single();
              finalModelId = nm?.id ?? finalModelId;
            }
          }
        }
      }

      // Insert anonymous review (no user attribution to the admin)
      const guestSessionId = `interview:${crypto.randomUUID()}`;
      const { error: rErr } = await supabase.from("reviews").insert({
        model_id: finalModelId,
        content: transcript || null,
        media_urls: [photoUrl],
        is_guest: true,
        guest_session_id: guestSessionId,
        user_id: null,
      });
      if (rErr) throw rErr;

      setStep("done");
    } catch (e: any) {
      toast.error("Failed to save interview: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setStep("audio");
    setAudioBlob(null);
    setTranscript("");
    setPhoto(null);
    setPhotoPreview("");
    setBrandId("");
    setModelId("");
    setCustomBrand("");
    setCustomModel("");
    setUseCustomBrand(false);
    setUseCustomModel(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display tracking-wider uppercase">Interview</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
          <X className="h-4 w-4 mr-1" /> Exit
        </Button>
      </div>

      {step !== "done" && (
        <div className="flex gap-1.5">
          {STEPS.slice(0, -1).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= idx ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      )}

      {/* Step 1: Audio */}
      {step === "audio" && (
        <Card className="p-6 rounded-none border-border space-y-4">
          <h2 className="text-xl font-display uppercase tracking-wider">1. Record interview</h2>
          <p className="text-sm text-muted-foreground">
            Hand the device to the interviewee or hold it close. Recording is transcribed automatically.
          </p>
          <AudioRecorder
            disabled={transcribing}
            onRecorded={(blob, mime) => {
              setAudioBlob(blob);
              setAudioMime(mime);
            }}
          />
          <div className="flex justify-end">
            <Button onClick={handleTranscribe} disabled={!audioBlob || transcribing}>
              {transcribing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transcribing…
                </>
              ) : (
                <>
                  Transcribe & continue <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Photo + shoe ID */}
      {step === "photo" && (
        <Card className="p-6 rounded-none border-border space-y-4">
          <h2 className="text-xl font-display uppercase tracking-wider">2. Photograph the shoe</h2>

          {photoPreview ? (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img src={photoPreview} alt="Shoe" className="w-full max-h-80 object-contain bg-muted" />
              {detecting && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2 text-sm">Identifying shoe…</span>
                </div>
              )}
            </div>
          ) : (
            <label className="aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
              <Camera className="w-10 h-10 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Take or choose a photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            </label>
          )}

          {photoPreview && (
            <label className="block text-sm text-muted-foreground cursor-pointer underline">
              Retake photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            </label>
          )}

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Brand</label>
              <Combobox
                items={brandItems}
                value={useCustomBrand ? "" : brandId}
                onChange={(v) => {
                  setUseCustomBrand(false);
                  setBrandId(v);
                  setModelId("");
                  setUseCustomModel(false);
                  setCustomModel("");
                }}
                onCustomSelect={(text) => {
                  setUseCustomBrand(true);
                  setCustomBrand(text);
                  setBrandId("");
                  setUseCustomModel(true);
                }}
                placeholder={useCustomBrand ? `New brand: ${customBrand}` : "Select brand…"}
                allowCustom
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Model</label>
              <Combobox
                items={modelItems}
                value={useCustomModel ? "" : modelId}
                onChange={(v) => {
                  setUseCustomModel(false);
                  setModelId(v);
                }}
                onCustomSelect={(text) => {
                  setUseCustomModel(true);
                  setCustomModel(text);
                }}
                placeholder={useCustomModel ? `New model: ${customModel}` : "Select model…"}
                allowCustom
                disabled={!useCustomBrand && !brandId}
              />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep("audio")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button
              onClick={() => setStep("confirm")}
              disabled={
                !photo ||
                (useCustomBrand
                  ? !customBrand || !customModel
                  : useCustomModel
                  ? !brandId || !customModel
                  : !modelId)
              }
            >
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === "confirm" && (
        <Card className="p-6 rounded-none border-border space-y-4">
          <h2 className="text-xl font-display uppercase tracking-wider">3. Confirm & submit</h2>

          {photoPreview && (
            <img src={photoPreview} alt="Shoe" className="w-full max-h-60 object-contain bg-muted rounded-lg border border-border" />
          )}

          <div className="text-sm">
            <span className="text-muted-foreground uppercase tracking-wider text-xs">Shoe: </span>
            <span className="font-medium">
              {useCustomBrand ? customBrand : brands?.find((b: any) => b.id === brandId)?.name}{" "}
              {useCustomModel ? customModel : models?.find((m: any) => m.id === modelId)?.name}
            </span>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
              Transcript (editable)
            </label>
            <Textarea
              rows={8}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Transcript will appear here…"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            This will be saved as an anonymous review (not attributed to your admin account).
          </p>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("photo")} disabled={submitting}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleSubmit} disabled={!canConfirm || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" /> Submit interview
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Done */}
      {step === "done" && (
        <Card className="p-8 rounded-none border-border text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-display uppercase tracking-wider">Saved</h2>
          <p className="text-muted-foreground">Anonymous review created from interview.</p>
          <div className="flex justify-center gap-3">
            <Button onClick={resetAll}>New interview</Button>
            <Button variant="outline" onClick={() => navigate("/admin")}>
              Back to admin
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
