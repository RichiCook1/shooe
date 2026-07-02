import { defineMcp } from "@lovable.dev/mcp-js";
import searchModelsTool from "./tools/search-models";
import getModelTool from "./tools/get-model";
import listReviewsTool from "./tools/list-reviews";
import bestForTool from "./tools/best-for";
import getBrandFactsTool from "./tools/get-brand-facts";

export default defineMcp({
  name: "shoe-sherpa-mcp",
  title: "Shoe Sherpa",
  version: "0.1.0",
  instructions:
    "Query the Shoe Sherpa catalog of community-verified running shoe reviews. Use search_models to find shoes by name, get_model for full detail + reviews, list_reviews to paginate every verified review, best_for for ranked shortlists per runner segment, and get_brand_facts for verified brand fit/tech notes. All data is public.",
  tools: [searchModelsTool, getModelTool, listReviewsTool, bestForTool, getBrandFactsTool],
});
