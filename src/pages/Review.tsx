import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Camera, Check, MapPin, Mountain, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Step = "media" | "shoe" | "details" | "tags" | "done";
const STEPS: Step[] = ["media", "shoe", "details", "tags", "done"];

const Review = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("media");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [distance, setDistance] = useState("");
  const [location, setLocation] = useState("");
  const [terrain, setTerrain] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: models } = useQuery({
    queryKey: ["models", selectedBrand],
    queryFn: async () => {
      if (!selectedBrand) return [];
      const { data } = await supabase.from("models").select("*").eq("brand_id", selectedBrand).order("name");
      return data ?? [];
    },
    enabled: !!selectedBrand,
  });

  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data } = await supabase.from("tags").select("*").eq("active", true).order("sort_order");
      return data ?? [];
    },
  });

  const positiveTags = tags?.filter((t) => t.type === "positive") ?? [];
  const negativeTags = tags?.filter((t) => t.type === "negative") ?? [];

  const handlePhotoAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 5) {
      toast.error("Maximum 5 photos allowed");
      return;
    }
    setPhotos((prev) => [...prev, ...files]);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }, [photos.length]);

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const canProceed = () => {
    switch (step) {
      case "media": return photos.length > 0;
      case "shoe": return !!selectedModel;
      case "details": return true;
      case "tags": return true;
      default: return false;
    }
  };

  const next = () => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  };
  const back = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Upload photos to storage
      const mediaUrls: string[] = [];
      for (const photo of photos) {
        const ext = photo.name.split(".").pop();
        const path = `guest/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("review-media").upload(path, photo);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("review-media").getPublicUrl(path);
        mediaUrls.push(urlData.publicUrl);
      }

      const guestSessionId = crypto.randomUUID();

      const { data: review, error } = await supabase.from("reviews").insert({
        model_id: selectedModel,
        content: content || null,
        distance_km: distance ? parseFloat(distance) : null,
        location: location || null,
        terrain: (terrain as "road" | "trail" | "mixed" | "track") || null,
        media_urls: mediaUrls,
        is_guest: true,
        guest_session_id: guestSessionId,
      }).select().single();

      if (error) throw error;

      // Insert tags
      if (selectedTags.length > 0 && review) {
        const tagInserts = selectedTags.map((tag_id) => ({ review_id: review.id, tag_id }));
        await supabase.from("review_tags").insert(tagInserts);
      }

      setStep("done");
    } catch (err: any) {
      toast.error("Failed to submit review: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Progress bar */}
        {step !== "done" && (
          <div className="flex gap-1.5 mb-8">
            {STEPS.slice(0, -1).map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        )}

        {/* Step: Media Upload */}
        {step === "media" && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold font-display mb-2">Add Photos</h1>
            <p className="text-muted-foreground mb-6">Upload at least one photo of your shoes. Up to 5 photos.</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(i)} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
                  <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Add Photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoAdd} multiple />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Step: Shoe Selection */}
        {step === "shoe" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h1 className="text-3xl font-bold font-display mb-2">Select Your Shoe</h1>
              <p className="text-muted-foreground mb-6">Choose the brand and model you're reviewing.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Brand</label>
                <Select value={selectedBrand} onValueChange={(v) => { setSelectedBrand(v); setSelectedModel(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>
                    {brands?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedBrand && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Model</label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>
                      {models?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Run Details */}
        {step === "details" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h1 className="text-3xl font-bold font-display mb-2">Run Details</h1>
              <p className="text-muted-foreground mb-6">Optional info about your run. Skip if you'd like.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Mountain className="w-4 h-4" /> Terrain
                </label>
                <Select value={terrain} onValueChange={setTerrain}>
                  <SelectTrigger><SelectValue placeholder="Select terrain" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="road">Road</SelectItem>
                    <SelectItem value="trail">Trail</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="track">Track</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Distance (km)</label>
                <Input type="number" placeholder="e.g. 42" value={distance} onChange={(e) => setDistance(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Location
                </label>
                <Input placeholder="e.g. Central Park, NYC" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step: Tags & Review */}
        {step === "tags" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h1 className="text-3xl font-bold font-display mb-2">Tag & Review</h1>
              <p className="text-muted-foreground mb-6">Select tags and optionally write your thoughts.</p>
            </div>

            {positiveTags.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-3 block text-success">👍 What you loved</label>
                <div className="flex flex-wrap gap-2">
                  {positiveTags.map((t) => (
                    <button key={t.id} onClick={() => toggleTag(t.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selectedTags.includes(t.id) 
                          ? "bg-success text-success-foreground border-success" 
                          : "bg-card border-border text-foreground hover:border-success/50"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {negativeTags.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-3 block text-destructive">👎 What could improve</label>
                <div className="flex flex-wrap gap-2">
                  {negativeTags.map((t) => (
                    <button key={t.id} onClick={() => toggleTag(t.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selectedTags.includes(t.id) 
                          ? "bg-destructive text-destructive-foreground border-destructive" 
                          : "bg-card border-border text-foreground hover:border-destructive/50"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Your Review (optional)</label>
              <Textarea
                placeholder="How did these shoes feel on your run? Any standout moments?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
              />
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="animate-fade-in text-center py-16">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-3xl font-bold font-display mb-3">Review Submitted!</h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Thanks for sharing your experience. Sign up to save this review to your profile and follow other runners.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate("/login")} className="bg-gradient-hero text-primary-foreground hover:opacity-90">
                Sign Up to Save
              </Button>
              <Button variant="outline" onClick={() => navigate("/")}>
                Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        {step !== "done" && (
          <div className="flex justify-between mt-10 pt-6 border-t border-border">
            <Button variant="ghost" onClick={back} disabled={stepIndex === 0}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {step === "tags" ? (
              <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-hero text-primary-foreground hover:opacity-90">
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
            ) : (
              <Button onClick={next} disabled={!canProceed()}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Review;
