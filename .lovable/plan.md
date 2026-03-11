

# "Ask the Shoe Sherpa" -- AI-Powered Shoe Search Chatbot

## Overview
A chatbot feature where users type natural language questions about shoes and get AI-generated answers grounded in the app's review data, followed by a feed of matching reviews.

## Architecture

```text
User Question
     │
     ▼
 Frontend Chat UI ──POST──▶ Edge Function: shoe-sherpa
                                  │
                                  ├─ 1. Query Supabase for ALL reviews
                                  │    (with model, brand, rating, content, location, category)
                                  │
                                  ├─ 2. Build prompt with review data as context
                                  │
                                  ├─ 3. Call Lovable AI (gemini-3-flash-preview)
                                  │    with tool_call to return structured output:
                                  │    { answer: string, relevant_review_ids: string[] }
                                  │
                                  └─ 4. Return answer + review IDs to frontend
                                         │
                                         ▼
                              Frontend renders:
                              - AI text answer
                              - Matching reviews as feed cards
```

## Implementation Plan

### 1. Edge Function: `supabase/functions/shoe-sherpa/index.ts`
- Accepts `{ question: string }` in POST body
- Fetches reviews from DB (with model name, brand name, rating, content, category, location) using the service role key
- Constructs a system prompt instructing the AI to act as "The Shoe Sherpa" -- a knowledgeable guide who recommends shoes based on real user reviews
- Uses Lovable AI with **tool calling** to extract structured output: a brief text answer + an array of relevant review IDs
- Returns `{ answer: string, reviewIds: string[] }`

### 2. New Page: `src/pages/Sherpa.tsx`
- Chat-style UI with a prominent input at the bottom
- On submit, calls the edge function
- Displays the AI answer as a message bubble
- Below the answer, renders matching reviews using the existing `ReviewCard` component in the standard feed grid layout
- Supports clicking into `ReviewDetailModal`

### 3. Navigation
- Add route `/sherpa` in `App.tsx`
- Add a "Shoe Sherpa" link/button in the Navbar (accessible to all users, including guests)
- Optionally add a prominent CTA on the landing page

### 4. Config
- Add `[functions.shoe-sherpa]` with `verify_jwt = false` to `supabase/config.toml` (public access for guests)
- Uses existing `LOVABLE_API_KEY` secret (already configured)

## Technical Details

**Edge function prompt strategy**: The function will fetch up to 200 recent reviews with their model/brand/category/rating/content. These get serialized into a compact format in the system prompt. The AI is instructed to identify which review IDs are relevant and provide a concise recommendation.

**Structured output via tool calling**: Instead of asking the model to return JSON directly, the edge function will use a `recommend_shoes` tool definition that returns `{ answer: string, relevant_review_ids: string[] }`.

**Frontend query flow**: After receiving review IDs from the edge function, the frontend fetches the full review objects (with profiles) from Supabase to render proper ReviewCards.

