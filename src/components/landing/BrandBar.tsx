import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BrandBar = () => {
  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="py-12 border-y border-border">
      <div className="container mx-auto px-4">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
          Reviews across top brands
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {brands?.map((brand) => (
            <span
              key={brand.id}
              className="text-lg md:text-xl font-display font-bold text-muted-foreground/50 hover:text-foreground transition-colors cursor-default"
            >
              {brand.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandBar;
