import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StatsSectionProps {
  inline?: boolean;
}

const StatsSection = ({ inline }: StatsSectionProps) => {
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
    { label: "Reviews", value: stats?.reviews ?? 0 },
    { label: "Models", value: stats?.models ?? 0 },
    { label: "Brands", value: stats?.brands ?? 0 },
  ];

  if (inline) {
    return (
      <div className="grid grid-cols-3 gap-8">
        {statItems.map((item, i) => (
          <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
            <p className="text-3xl md:text-4xl font-display">{item.value}+</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1">{item.label}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
          {statItems.map((item, i) => (
            <div key={i} className="text-center animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <p className="text-4xl md:text-5xl font-display">{item.value}+</p>
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mt-2">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
