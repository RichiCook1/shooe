import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera } from "lucide-react";
import { toast } from "sonner";

const EditProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "true";
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [footSize, setFootSize] = useState("");
  const [footWidth, setFootWidth] = useState("");
  const [weeklyVolume, setWeeklyVolume] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["own-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setAge(profile.age?.toString() ?? "");
      setHeightCm(profile.height_cm?.toString() ?? "");
      setWeightKg(profile.weight_kg?.toString() ?? "");
      setFootSize(profile.foot_size?.toString() ?? "");
      setFootWidth(profile.foot_width ?? "");
      setWeeklyVolume(profile.weekly_volume ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(urlData.publicUrl + "?t=" + Date.now());
    } catch (err: any) {
      toast.error("Failed to upload avatar: " + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates = {
        user_id: user.id,
        username: username || null,
        display_name: displayName || null,
        bio: bio || null,
        age: age ? parseInt(age) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        foot_size: footSize ? parseFloat(footSize) : null,
        foot_width: (footWidth as "narrow" | "regular" | "wide") || null,
        weekly_volume: (weeklyVolume as "lt_10km" | "10_30km" | "gt_30km") || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      };

      if (profile) {
        const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profiles").insert(updates);
        if (error) throw error;
      }

      toast.success("Profile saved!");
      navigate(isOnboarding ? "/feed" : "/profile");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigate("/feed");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-bold font-display">
            {isOnboarding ? "Complete Your Profile" : "Edit Profile"}
          </h1>
          {isOnboarding && (
            <p className="text-sm text-muted-foreground mt-1">
              Tell us about yourself so other runners can find you.
            </p>
          )}
        </div>

        <div className="space-y-4">
          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 group">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">
                  {(displayName || username || "R")[0]?.toUpperCase()}
                </span>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              {uploadingAvatar ? "Uploading..." : "Hover to change photo"}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Username</label>
            <Input placeholder="runnerJane" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Display Name</label>
            <Input placeholder="Jane Doe" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Bio</label>
            <Textarea placeholder="Tell us about your running journey..." value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>

          <hr className="border-border" />
          <h2 className="text-lg font-bold font-display">Running Profile</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Age</label>
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Height (cm)</label>
              <Input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Weight (kg)</label>
              <Input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Foot Size (EU)</label>
              <Input type="number" value={footSize} onChange={(e) => setFootSize(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Foot Width</label>
            <Select value={footWidth} onValueChange={setFootWidth}>
              <SelectTrigger><SelectValue placeholder="Select width" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="narrow">Narrow</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Weekly Volume</label>
            <Select value={weeklyVolume} onValueChange={setWeeklyVolume}>
              <SelectTrigger><SelectValue placeholder="Select volume" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lt_10km">Less than 10 km</SelectItem>
                <SelectItem value="10_30km">10–30 km</SelectItem>
                <SelectItem value="gt_30km">More than 30 km</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Saving..." : isOnboarding ? "Confirm" : "Save Profile"}
            </Button>
            {isOnboarding ? (
              <Button variant="outline" onClick={handleSkip} className="flex-1">
                Skip
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/profile")}>Cancel</Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EditProfile;
