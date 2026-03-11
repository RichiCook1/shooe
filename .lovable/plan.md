
# Fix: "invalid input syntax for type uuid" on Review Submit

## The Problem
When you select an existing brand but type a custom model name, the app crashes with `invalid input syntax for type uuid: ""`. This happens because the code only creates a new model when **both** brand and model are custom. If only the model is custom (but the brand was selected from the list), the empty string `""` from `selectedModel` gets sent to the database as the `model_id`, which expects a valid UUID.

## The Fix
Update the `handleSubmit` function in `src/pages/Review.tsx` to handle the case where `useCustomModel` is true but `useCustomBrand` is false. In that scenario, we need to:

1. Use `selectedBrand` as the `brandId`
2. Look up or create the custom model under that brand
3. Set `modelId` to the result

### Technical Detail

Add a new `else if` block after the existing `useCustomBrand` check (around line 155):

```typescript
let modelId = selectedModel;

if (useCustomBrand && customBrand && customModel) {
  // ... existing logic for custom brand + custom model (unchanged)
} else if (useCustomModel && selectedBrand && customModel) {
  // NEW: handle existing brand + custom model
  const brandId = selectedBrand;
  const { data: existingModel } = await supabase
    .from("models").select("id")
    .eq("brand_id", brandId).ilike("name", customModel).maybeSingle();
  if (existingModel) {
    modelId = existingModel.id;
  } else {
    const { data: newModel, error: modelErr } = await supabase
      .from("models").insert({ name: customModel, brand_id: brandId }).select().single();
    if (modelErr) {
      toast.error("Could not create model. Please try again.");
      setSubmitting(false);
      return;
    }
    modelId = newModel.id;
  }
}
```

This is a single-file fix in `src/pages/Review.tsx`.
