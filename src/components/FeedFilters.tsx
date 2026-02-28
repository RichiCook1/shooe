import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FeedFiltersProps {
  brand: string;
  category: string;
  terrain: string;
  sort: string;
  onBrandChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onTerrainChange: (v: string) => void;
  onSortChange: (v: string) => void;
}

const FeedFilters = ({ brand, category, terrain, sort, onBrandChange, onCategoryChange, onTerrainChange, onSortChange }: FeedFiltersProps) => {
  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").order("name");
      return data ?? [];
    },
  });

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Select value={brand} onValueChange={onBrandChange}>
        <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Brand" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Brands</SelectItem>
          {brands?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="road">Road</SelectItem>
          <SelectItem value="trail">Trail</SelectItem>
          <SelectItem value="track">Track</SelectItem>
          <SelectItem value="racing">Racing</SelectItem>
        </SelectContent>
      </Select>

      <Select value={terrain} onValueChange={onTerrainChange}>
        <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="Terrain" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Terrain</SelectItem>
          <SelectItem value="road">Road</SelectItem>
          <SelectItem value="trail">Trail</SelectItem>
          <SelectItem value="mixed">Mixed</SelectItem>
          <SelectItem value="track">Track</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue placeholder="Sort" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Most Recent</SelectItem>
          <SelectItem value="rating">Highest Rated</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default FeedFilters;
