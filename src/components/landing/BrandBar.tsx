import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BrandBar = () => {
  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="py-10 border-y border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {brands?.map((brand) => (
            <span
              key={brand.id}
              className="text-sm uppercase tracking-[0.15em] font-medium text-muted-foreground/40 hover:text-foreground transition-colors cursor-default"
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
