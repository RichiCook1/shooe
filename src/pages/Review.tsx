import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { ArrowLeft, ArrowRight, Camera, Check, MapPin, Mountain, Navigation, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";

const CATEGORIES = [
  { value: "road", label: "Road" },
  { value: "trail", label: "Trail" },
  { value: "track", label: "Track" },
  { value: "racing", label: "Racing" },
  { value: "indoor_climbing", label: "Indoor Climbing" },
  { value: "outdoor_climbing", label: "Outdoor Climbing" },
  { value: "mountaineering", label: "Mountaineering" },
  { value: "hiking", label: "Hiking" },
  { value: "recovery", label: "Recovery" },
  { value: "cross_training", label: "Cross Training" },
  { value: "walking", label: "Walking" },
];

type Step = "media" | "shoe" | "details" | "tags" | "done";
const STEPS: Step[] = ["media", "shoe", "details", "tags", "done"];

const Review = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editReviewId = searchParams.get("edit");
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("media");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [useCustomBrand, setUseCustomBrand] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [distance, setDistance] = useState("");
  const [location, setLocation] = useState("");
  const [terrain, setTerrain] = useState("");
  const [shoeCategory, setShoeCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
    const [rating, setRating] = useState<number | null>(null);
    const [ratingTouched, setRatingTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  // Load existing review for editing
  useQuery({
    queryKey: ["edit-review", editReviewId],
    queryFn: async () => {
      if (!editReviewId) return null;
      const { data } = await supabase.from("reviews").select(`*, model:models(id, name, category, brand_id, brand:brands(id, name))`).eq("id", editReviewId).single();
      if (data) {
        setContent(data.content || "");
        setRating(data.rating ?? 5);
        setDistance(data.distance_km?.toString() || "");
        setLocation(data.location || "");
        setTerrain(data.terrain || "");
        setExistingMediaUrls(data.media_urls || []);
        setPhotoPreviews(data.media_urls || []);
        if (data.model) {
          setSelectedBrand(data.model.brand_id);
          setSelectedModel(data.model.id);
          setShoeCategory(data.model.category || "");
        }
        // Load tags
        const { data: reviewTags } = await supabase.from("review_tags").select("tag_id").eq("review_id", editReviewId);
        if (reviewTags) setSelectedTags(reviewTags.map((rt: any) => rt.tag_id));
      }
      return data;
    },
    enabled: !!editReviewId,
  });

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
    enabled: !!selectedBrand && !useCustomBrand,
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

  const handlePhotoAdd = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length + existingMediaUrls.length > 5) {
      toast.error("Maximum 5 photos allowed");
      return;
    }
    // Compress images before adding
    const compressed = await Promise.all(files.map((f) => compressImage(f)));
    setPhotos((prev) => [...prev, ...compressed]);
    compressed.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }, [photos.length, existingMediaUrls.length]);

  const removePhoto = (idx: number) => {
    if (idx < existingMediaUrls.length) {
      // Removing an existing URL
      setExistingMediaUrls((prev) => prev.filter((_, i) => i !== idx));
      setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
    } else {
      const photoIdx = idx - existingMediaUrls.length;
      setPhotos((prev) => prev.filter((_, i) => i !== photoIdx));
      setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || "";
          const country = data.address?.country || "";
          setLocation([city, country].filter(Boolean).join(", ") || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setGeoLoading(false);
      },
      () => {
        toast.error("Could not get your location");
        setGeoLoading(false);
      }
    );
  };

  const canProceed = () => {
    switch (step) {
      case "media": return true;
      case "shoe": return useCustomBrand ? (!!customBrand && !!customModel) : useCustomModel ? (!!selectedBrand && !!customModel) : !!selectedModel;
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
      // Upload new photos (already compressed)
      const newMediaUrls: string[] = [];
      const folder = user ? `user/${user.id}` : "guest";
      for (const photo of photos) {
        const ext = photo.name.split(".").pop();
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("review-media").upload(path, photo);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("review-media").getPublicUrl(path);
        newMediaUrls.push(urlData.publicUrl);
      }

      const allMediaUrls = [...existingMediaUrls, ...newMediaUrls];

      let modelId = selectedModel;

      if (useCustomBrand && customBrand && customModel) {
        let brandId: string;
        const { data: existingBrand } = await supabase.from("brands").select("id").ilike("name", customBrand).maybeSingle();
        if (existingBrand) {
          brandId = existingBrand.id;
        } else {
          const { data: newBrand, error: brandErr } = await supabase.from("brands").insert({ name: customBrand }).select().single();
          if (brandErr) {
            toast.error("Could not create brand. Please try again.");
            setSubmitting(false);
            return;
          }
          brandId = newBrand.id;
        }

        const { data: existingModel } = await supabase.from("models").select("id").eq("brand_id", brandId).ilike("name", customModel).maybeSingle();
        if (existingModel) {
          modelId = existingModel.id;
        } else {
          const { data: newModel, error: modelErr } = await supabase.from("models").insert({ name: customModel, brand_id: brandId, category: (shoeCategory as any) || null }).select().single();
          if (modelErr) {
            toast.error("Could not create model. Please try again.");
            setSubmitting(false);
            return;
          }
          modelId = newModel.id;
        }
      } else if (useCustomModel && selectedBrand && customModel) {
        const brandId = selectedBrand;
        const { data: existingModel } = await supabase
          .from("models").select("id")
          .eq("brand_id", brandId).ilike("name", customModel).maybeSingle();
        if (existingModel) {
          modelId = existingModel.id;
        } else {
          const { data: newModel, error: modelErr } = await supabase
            .from("models").insert({ name: customModel, brand_id: brandId, category: (shoeCategory as any) || null }).select().single();
          if (modelErr) {
            toast.error("Could not create model. Please try again.");
            setSubmitting(false);
            return;
          }
          modelId = newModel.id;
        }
      }

      // Update category on existing model if selected
      if (!useCustomBrand && !useCustomModel && shoeCategory && modelId) {
        await supabase.from("models").update({ category: shoeCategory as any }).eq("id", modelId);
      }

      if (editReviewId) {
        // Update existing review
        const { error } = await supabase.from("reviews").update({
          model_id: modelId,
          content: content || null,
          distance_km: distance ? parseFloat(distance) : null,
          location: location || null,
          terrain: (terrain as any) || null,
          media_urls: allMediaUrls,
          rating,
        }).eq("id", editReviewId);

        if (error) throw error;

        // Update tags: delete old, insert new
        await supabase.from("review_tags").delete().eq("review_id", editReviewId);
        if (selectedTags.length > 0) {
          const tagInserts = selectedTags.map((tag_id) => ({ review_id: editReviewId, tag_id }));
          await supabase.from("review_tags").insert(tagInserts);
        }

        setStep("done");
      } else {
        // Create new review
        const isLoggedIn = !!user;
        const guestSessionId = isLoggedIn ? null : crypto.randomUUID();

        if (!isLoggedIn && guestSessionId) {
          localStorage.setItem("guest_session_id", guestSessionId);
        }

        const { data: review, error } = await supabase.from("reviews").insert({
          model_id: modelId,
          content: content || null,
          distance_km: distance ? parseFloat(distance) : null,
          location: location || null,
          terrain: (terrain as any) || null,
          media_urls: allMediaUrls,
          is_guest: !isLoggedIn,
          guest_session_id: guestSessionId,
          user_id: isLoggedIn ? user.id : null,
          rating,
        }).select().single();

        if (error) throw error;

        if (selectedTags.length > 0 && review) {
          const tagInserts = selectedTags.map((tag_id) => ({ review_id: review.id, tag_id }));
          await supabase.from("review_tags").insert(tagInserts);
        }

        setStep("done");
      }
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
            <p className="text-muted-foreground mb-6">Upload up to 5 photos of your shoes (optional). Images are automatically compressed.</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-border group">
                  <img src={src} alt="" className="w-full object-contain bg-muted max-h-48" />
                  <button onClick={() => removePhoto(i)} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {photos.length + existingMediaUrls.length < 5 && (
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
              {!useCustomBrand ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Brand</label>
                    <Select value={selectedBrand} onValueChange={(v) => { setSelectedBrand(v); setSelectedModel(""); }}>
                      <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                      <SelectContent>
                        {brands?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedBrand && !useCustomModel ? (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Model</label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                        <SelectContent>
                          {models?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : selectedBrand && useCustomModel ? (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Model Name</label>
                      <Input placeholder="e.g. Pegasus 41" value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
                    </div>
                  ) : null}
                  {selectedBrand && (
                    <button type="button" onClick={() => setUseCustomModel(!useCustomModel)} className="text-sm text-primary hover:underline">
                      {useCustomModel ? "← Back to model list" : "Model not listed? Type it manually"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Brand Name</label>
                    <Input placeholder="e.g. On Running" value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Model Name</label>
                    <Input placeholder="e.g. Cloudmonster 2" value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => { setUseCustomBrand(!useCustomBrand); setUseCustomModel(false); setCustomBrand(""); setCustomModel(""); setSelectedBrand(""); setSelectedModel(""); }}
                className="text-sm text-primary hover:underline"
              >
                {useCustomBrand ? "← Back to brand list" : "Brand not listed? Type it manually"}
              </button>

              {/* Category selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={shoeCategory} onValueChange={setShoeCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                <div className="flex gap-2">
                  <LocationAutocomplete value={location} onChange={setLocation} className="flex-1" />
                  <Button type="button" variant="outline" size="icon" onClick={handleGeolocate} disabled={geoLoading} title="Use my location">
                    <Navigation className={`w-4 h-4 ${geoLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Tags & Review */}
        {step === "tags" && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h1 className="text-3xl font-bold font-display mb-2">Rate & Review</h1>
              <p className="text-muted-foreground mb-6">Score the shoe, select tags, and share your thoughts.</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block">Overall Score</label>
              <div className="flex items-center gap-4">
                <Slider value={[rating]} onValueChange={(v) => setRating(v[0])} min={0} max={10} step={0.5} className="flex-1" />
                <span className="text-2xl font-bold font-display min-w-[3ch] text-center text-primary">{rating}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0 – Awful</span>
                <span>10 – Perfect</span>
              </div>
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
              <Textarea placeholder="How did these shoes feel on your run? Any standout moments?" value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="animate-fade-in text-center py-16">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-3xl font-bold font-display mb-3">
              {editReviewId ? "Review Updated!" : "Review Submitted!"}
            </h1>
            {user ? (
              <>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Your review has been saved to your profile. Check it out in the feed!
                </p>
                <Button onClick={() => navigate("/feed")} className="bg-gradient-hero text-primary-foreground hover:opacity-90">
                  View Feed
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Thanks for sharing your experience. Sign up to save this review to your profile and follow other runners.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => navigate("/login?mode=signup")} className="bg-gradient-hero text-primary-foreground hover:opacity-90">
                    Sign Up to Save
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/")}>
                    Back to Home
                  </Button>
                </div>
              </>
            )}
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
                {submitting ? "Submitting..." : editReviewId ? "Update Review" : "Submit Review"}
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
