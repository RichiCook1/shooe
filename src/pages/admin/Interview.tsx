import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { AudioRecorder } from "@/components/admin/AudioRecorder";
import { compressImage } from "@/lib/imageCompression";
import { Camera, Check, Loader2, X, Send, AlertCircle, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

const blobToBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });

type JobStatus = "processing" | "done" | "error";
interface JobPayload {
  blob: Blob | null;
  mime: string;
  file: File;
  rating: number | null;
}
interface Job {
  id: string;
  startedAt: number;
  status: JobStatus;
  label: string;
  error?: string;
  payload?: JobPayload;
}

async function processInterview(audioBlob: Blob | null, audioMime: string, photo: File, rating: number | null) {
  // Upload photo
  const ext = photo.name.split(".").pop() || "jpg";
  const path = `interview/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("review-media").upload(path, photo);
  if (upErr) throw upErr;
  const photoUrl = supabase.storage.from("review-media").getPublicUrl(path).data.publicUrl;

  // Read photo as base64 for identification
  const photoB64 = await blobToBase64(photo);

  // Run transcription + identification in parallel
  const transcribePromise = audioBlob
    ? (async () => {
        const b64 = await blobToBase64(audioBlob);
        const { data, error } = await supabase.functions.invoke("transcribe-interview", {
          body: { audioBase64: b64, mimeType: audioMime },
        });
        if (error) throw error;
        return (data?.transcript || "").trim();
      })()
    : Promise.resolve("");

  const identifyPromise = (async () => {
    const { data, error } = await supabase.functions.invoke("identify-shoe-from-image", {
      body: { imageBase64: photoB64 },
    });
    if (error) throw error;
    return data;
  })();

  const [transcript, idData] = await Promise.all([
    transcribePromise.catch((e) => { console.error("transcribe failed", e); return ""; }),
    identifyPromise,
  ]);

  // Resolve model id — fall back to "Unidentified" placeholder so the review is never lost
  let finalModelId: string | null = idData?.modelMatch?.id ?? null;
  let needsIdentification = false;

  if (!finalModelId) {
    const brandName: string = idData?.brandMatch?.name ?? idData?.brand ?? "";
    const modelName: string = idData?.model ?? "";

    if (brandName && modelName) {
      try {
        const { data: result, error: vErr } = await supabase.functions.invoke("validate-shoe-name", {
          body: { brand: brandName, model: modelName, brandId: idData?.brandMatch?.id },
        });
        if (vErr || !result?.modelId) throw vErr ?? new Error("validation failed");
        finalModelId = result.modelId;
      } catch {
        let bId: string | null = idData?.brandMatch?.id ?? null;
        if (!bId) {
          const { data: existing } = await supabase.from("brands").select("id").ilike("name", brandName).maybeSingle();
          if (existing) bId = existing.id;
          else {
            const { data: nb } = await supabase.from("brands").insert({ name: brandName }).select().single();
            bId = nb?.id ?? null;
          }
        }
        if (bId) {
          const { data: existingM } = await supabase.from("models").select("id").eq("brand_id", bId).ilike("name", modelName).maybeSingle();
          if (existingM) finalModelId = existingM.id;
          else {
            const { data: nm } = await supabase.from("models").insert({ name: modelName, brand_id: bId, pending_review: true }).select().single();
            finalModelId = nm?.id ?? null;
          }
        }
      }
    }
  }

  // Last-resort fallback: attach to an "Unidentified" placeholder model so the draft is saved
  if (!finalModelId) {
    needsIdentification = true;
    const { data: unkBrand } = await supabase.from("brands").select("id").ilike("name", "Unknown").maybeSingle();
    let unkBrandId = unkBrand?.id ?? null;
    if (!unkBrandId) {
      const { data: nb } = await supabase.from("brands").insert({ name: "Unknown" }).select().single();
      unkBrandId = nb?.id ?? null;
    }
    if (!unkBrandId) throw new Error("Could not create fallback brand");
    const { data: unkModel } = await supabase
      .from("models").select("id").eq("brand_id", unkBrandId).ilike("name", "Unidentified (needs ID)").maybeSingle();
    if (unkModel) finalModelId = unkModel.id;
    else {
      const { data: nm } = await supabase
        .from("models")
        .insert({ name: "Unidentified (needs ID)", brand_id: unkBrandId, pending_review: true })
        .select().single();
      finalModelId = nm?.id ?? null;
    }
  }

  if (!finalModelId) throw new Error("Could not resolve shoe model");

  const { data: authData } = await supabase.auth.getUser();
  const adminId = authData?.user?.id || "anon";
  const guestSessionId = `interview:${adminId}:${crypto.randomUUID()}`;
  const noteSuffix = needsIdentification ? "\n\n[NEEDS SHOE IDENTIFICATION]" : "";
  const { error: rErr } = await supabase.from("reviews").insert({
    model_id: finalModelId,
    content: (transcript || "") + noteSuffix || null,
    media_urls: [photoUrl],
    is_guest: true,
    guest_session_id: guestSessionId,
    user_id: null,
    rating: rating,
  });
  if (rErr) throw rErr;
  return { needsIdentification };
}

export default function AdminInterview() {
  const navigate = useNavigate();

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMime, setAudioMime] = useState<string>("audio/webm");
  const [audioKey, setAudioKey] = useState(0); // remount recorder to reset
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [rating, setRating] = useState<number | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  // Warn before leaving while jobs are still processing
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (jobsRef.current.some((j) => j.status === "processing")) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

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
  };

  const runJob = (id: string, label: string, payload: JobPayload) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: "processing", error: undefined, payload } : j)),
    );
    processInterview(payload.blob, payload.mime, payload.file, payload.rating)
      .then((res) => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "done", payload: undefined } : j)));
        if (res?.needsIdentification) {
          toast.warning(`${label} saved as draft — shoe needs identification`);
        } else {
          toast.success(`${label} saved`);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setJobs((prev) =>
          prev.map((j) => (j.id === id ? { ...j, status: "error", error: err.message || String(err) } : j)),
        );
        toast.error(`${label} failed: ${err.message || err}`);
      });
  };

  const submit = () => {
    if (!photo) {
      toast.error("Take a photo first");
      return;
    }
    const id = crypto.randomUUID();
    const label = `Interview ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const payload: JobPayload = { blob: audioBlob, mime: audioMime, file: photo, rating };
    setJobs((prev) => [{ id, startedAt: Date.now(), status: "processing", label, payload }, ...prev]);

    setAudioBlob(null);
    setPhoto(null);
    setPhotoPreview("");
    setRating(null);
    setAudioKey((k) => k + 1);

    toast.success("Submitted — processing in background");
    runJob(id, label, payload);
  };

  const retry = (job: Job) => {
    if (!job.payload) {
      toast.error("No data to retry — re-record");
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      return;
    }
    toast.message(`Retrying ${job.label}…`);
    runJob(job.id, job.label, job.payload);
  };

  const dismiss = (job: Job) => setJobs((prev) => prev.filter((j) => j.id !== job.id));

  const clearDone = () => setJobs((prev) => prev.filter((j) => j.status === "processing"));

  const canSubmit = !!photo;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display tracking-wider uppercase">Interview</h1>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <QrCode className="h-4 w-4 mr-1" />
                Self-review
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-lg font-display uppercase tracking-wider text-center">
                  Review yourself
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                <QRCodeSVG
                  value="https://shoe-sherpa.com/review"
                  size={200}
                  bgColor="transparent"
                  fgColor="currentColor"
                  className="text-foreground"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code to write your own review on your phone.
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <X className="h-4 w-4 mr-1" /> Exit
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Record, snap, submit. Transcription and shoe ID happen in the background — keep moving.
      </p>

      {/* Audio */}
      <Card className="p-6 rounded-none border-border space-y-3">
        <h2 className="text-sm font-display uppercase tracking-wider text-muted-foreground">1. Voice</h2>
        <AudioRecorder
          key={audioKey}
          onRecorded={(blob, mime) => {
            setAudioBlob(blob);
            setAudioMime(mime);
          }}
        />
      </Card>

      {/* Photo */}
      <Card className="p-6 rounded-none border-border space-y-3">
        <h2 className="text-sm font-display uppercase tracking-wider text-muted-foreground">2. Shoe photo</h2>
        {photoPreview ? (
          <>
            <img
              src={photoPreview}
              alt="Shoe"
              className="w-full max-h-80 object-contain bg-muted rounded-lg border border-border"
            />
            <label className="block text-sm text-muted-foreground cursor-pointer underline">
              Retake photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            </label>
          </>
        ) : (
          <label className="aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
            <Camera className="w-10 h-10 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Take or choose a photo</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </label>
        )}
      </Card>

      {/* Optional rating */}
      <Card className="p-6 rounded-none border-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-display uppercase tracking-wider text-muted-foreground">
            3. Rating (optional)
          </h2>
          {rating !== null && (
            <button
              type="button"
              onClick={() => setRating(null)}
              className="text-xs text-muted-foreground underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-display tabular-nums">
            {rating === null ? "—" : rating.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">/ 10</span>
        </div>
        <Slider
          min={0}
          max={10}
          step={0.5}
          value={[rating ?? 0]}
          onValueChange={(v) => setRating(v[0])}
        />
      </Card>

      {/* Submit */}
      <Button onClick={submit} disabled={!canSubmit} size="lg" className="w-full h-14">
        <Send className="h-5 w-5 mr-2" />
        Submit & next
      </Button>
      {!audioBlob && photo && (
        <p className="text-xs text-muted-foreground text-center">
          No audio recorded — review will be saved photo-only.
        </p>
      )}

      {/* Background job queue */}
      {jobs.length > 0 && (
        <Card className="p-4 rounded-none border-border space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
              Background ({jobs.filter((j) => j.status === "processing").length} processing)
            </h3>
            {jobs.some((j) => j.status !== "processing") && (
              <button onClick={clearDone} className="text-xs text-muted-foreground underline">
                Clear
              </button>
            )}
          </div>
          <ul className="space-y-1.5">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-2 text-sm">
                {j.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {j.status === "done" && <Check className="h-4 w-4 text-primary" />}
                {j.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                <span className="flex-1 truncate">{j.label}</span>
                {j.status === "error" && (
                  <>
                    <span className="text-xs text-destructive truncate max-w-[30%]">{j.error}</span>
                    {j.payload && (
                      <button onClick={() => retry(j)} className="text-xs underline font-medium">
                        Retry
                      </button>
                    )}
                    <button onClick={() => dismiss(j)} className="text-xs text-muted-foreground underline">
                      Dismiss
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
