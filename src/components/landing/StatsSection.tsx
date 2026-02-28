import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Footprints, Globe, Tag } from "lucide-react";

const StatsSection = () => {
  const { data: stats } = useQuery({
    queryKey: ["landing-stats"],
    queryFn: async () => {
      const [reviewsRes, modelsRes, brandsRes] = await Promise.all([
        supabase.from("reviews").select("id", { count: "exact", head: true }),
        supabase.from("models").select("id", { count: "exact", head: true }),
        supabase.from("brands").select("id", { count: "exact", head: true }),
      ]);
      return {
        reviews: reviewsRes.count ?? 0,
        models: modelsRes.count ?? 0,
        brands: brandsRes.count ?? 0,
      };
    },
  });

  const statItems = [
    { icon: MessageSquare, label: "Reviews", value: stats?.reviews ?? 0 },
    { icon: Footprints, label: "Shoe Models", value: stats?.models ?? 0 },
    { icon: Globe, label: "Brands", value: stats?.brands ?? 0 },
    { icon: Tag, label: "Tags Available", value: 20 },
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {statItems.map((item, i) => (
            <div key={i} className="text-center animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-3">
                <item.icon className="w-6 h-6" />
              </div>
              <p className="text-3xl md:text-4xl font-bold font-display">{item.value}+</p>
              <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
