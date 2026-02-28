

# Fix Auth, Feed, Review & Social Features

## Issues to Fix

### 1. Auto-Login After Email Verification
The `AuthContext` already listens to `onAuthStateChange`, but the Login page doesn't redirect when the auth state changes externally (e.g., email verification in another tab). Add a `useEffect` in `Login.tsx` that watches the `user` from `AuthContext` and redirects to `/feed` when authenticated.

### 2. Logged-In Review Flow
Currently, `Review.tsx` always submits as a guest (`is_guest: true`) and shows "Sign Up to Save" at the end. Fix:
- Check auth state via `useAuth()`
- If logged in: set `user_id`, `is_guest: false`, skip the signup CTA, show a "View Feed" confirmation instead
- If guest: keep current flow but store `guest_session_id` in localStorage for later association

### 3. Associate Guest Reviews on Signup
- Store `guest_session_id` in localStorage during guest review
- After signup + email confirmation, call an update to associate orphaned guest reviews with the new user via a database function or direct update
- Create a migration to allow updating `user_id` and `is_guest` on reviews matching a `guest_session_id`

### 4. User Search Bar
Add a search input in the Feed page header and Navbar that searches profiles by username/display_name. Show results in a dropdown with links to user profiles.

### 5. Feed Filters
Add filter bar at the top of the Feed page with:
- Brand filter (dropdown from brands table)
- Shoe category filter (road/trail/mixed/track)
- Terrain filter
- Sort by (recent, highest rated)
These filter the reviews query dynamically.

### 6. Location Autocomplete
Replace the plain text input in the Review details step with an autocomplete that queries the OpenStreetMap Nominatim search API as the user types (debounced), showing dropdown suggestions.

### 7. Working Likes
- Add like/unlike toggle in `ReviewCard` using `useAuth()` user ID
- Insert/delete from `likes` table
- Show like count and filled heart if liked by current user
- Seed ~100 likes across existing reviews via migration

### 8. Working Comments
- Add comment section that expands when the comment icon is clicked (inside the review detail modal)
- Insert/read from `comments` table
- Seed ~80 demo comments across existing reviews

### 9. Review Detail Modal
When tapping a review card in the feed, open a Dialog/Sheet showing:
- All photos (carousel)
- Full review content (not truncated)
- All tags
- Rating
- Comments section with input to add new comment
- Like button

### 10. Remove Google Maps from Location Badges
The location badges in `ReviewCard` currently just show text with a MapPin icon. Ensure they are NOT wrapped in anchor tags or links -- just static badges (this appears to already be the case, but will verify and ensure no external link behavior).

---

## Technical Plan

### Database Changes (Migration)
- Seed ~100 likes across existing reviews with random user assignments
- Seed ~80 comments with realistic running discussion content
- Create a function `claim_guest_reviews(p_user_id uuid, p_session_id text)` that updates reviews where `guest_session_id` matches and `is_guest = true`

### Files to Create
- `src/components/ReviewDetailModal.tsx` -- full review modal with photos, tags, comments, likes
- `src/components/UserSearch.tsx` -- search bar component with profile results dropdown
- `src/components/FeedFilters.tsx` -- filter bar for brand, category, terrain, sort
- `src/components/LocationAutocomplete.tsx` -- debounced location search with Nominatim API suggestions

### Files to Modify
- `src/pages/Review.tsx` -- auth-aware submission, guest session localStorage, location autocomplete
- `src/pages/Feed.tsx` -- add search bar, filters, review detail modal
- `src/pages/Login.tsx` -- watch auth state for auto-redirect, call `claim_guest_reviews` on login
- `src/components/ReviewCard.tsx` -- working like toggle, click to open detail modal
- `src/components/landing/Navbar.tsx` -- add user search in navbar
- `src/contexts/AuthContext.tsx` -- no changes needed (already has onAuthStateChange)

### Auth Flow After Changes
1. Guest leaves review -> `guest_session_id` saved to localStorage
2. Guest signs up -> confirms email -> `onAuthStateChange` fires -> redirect to `/feed`
3. On first authenticated load, check localStorage for `guest_session_id` -> call claim function -> clear localStorage
4. Logged-in user leaves review -> review saved with `user_id`, lands on feed after submission

