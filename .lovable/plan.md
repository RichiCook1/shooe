

# Fix Auth Flow & Build Authenticated User Experience

## Problems Identified
1. After email verification, user lands on `/` (landing page) with no authenticated experience
2. After manual login, user is navigated to `/` which is still just the landing page
3. No Feed page, Profile page, or any authenticated views exist
4. Navbar always shows "Log In" -- never adapts to show logged-in user options
5. No global auth state listener (`onAuthStateChange`) to detect when user confirms email and auto-logs in

---

## Solution

### 1. Auth Context Provider
Create `src/contexts/AuthContext.tsx` -- a global auth provider that:
- Listens to `onAuthStateChange` (handles email confirmation auto-login)
- Exposes `user`, `session`, `loading`, `signOut` to the whole app
- Wraps the app in `App.tsx`

### 2. New Pages

**Feed Page (`src/pages/Feed.tsx`)**
- The "home" for logged-in users
- Shows reviews from followed users, trending reviews, recommended reviews
- Sort by recent / relevant
- Infinite scroll with pagination

**Profile Page (`src/pages/Profile.tsx`)**
- Instagram-style layout: avatar, bio, running stats, follower/following counts
- Grid of user's reviews
- Edit profile button (own profile)
- Route: `/profile/:userId` and `/profile` (own profile shortcut)

**Edit Profile Page (`src/pages/EditProfile.tsx`)**
- Form to update: avatar, username, display name, bio, demographics, running profile
- All optional fields from the sign-up spec

### 3. Updated Navbar
- When logged out: show "Log In" + "Leave a Review"
- When logged in: show avatar dropdown with links to Feed, My Profile, Settings, Log Out + "Leave a Review" button

### 4. Updated Login Page
- After successful login, navigate to `/feed` instead of `/`
- After signup, show confirmation message (already works)
- `onAuthStateChange` in AuthContext will detect email confirmation and redirect to `/feed`

### 5. Smart Landing Page Redirect
- If user visits `/` while authenticated, auto-redirect to `/feed`

### 6. Updated App.tsx Routes
Add routes:
- `/feed` -- Feed page
- `/profile` -- Own profile
- `/profile/:userId` -- Public profile view
- `/edit-profile` -- Edit profile

---

## Technical Details

### Files to Create
- `src/contexts/AuthContext.tsx` -- auth state provider with `onAuthStateChange`
- `src/pages/Feed.tsx` -- personalized feed with review cards
- `src/pages/Profile.tsx` -- Instagram-style profile with review grid
- `src/pages/EditProfile.tsx` -- profile editing form
- `src/components/ReviewCard.tsx` -- reusable review card (used in feed + profile)
- `src/components/ProtectedRoute.tsx` -- redirects to `/login` if not authenticated

### Files to Modify
- `src/App.tsx` -- wrap with AuthProvider, add new routes
- `src/components/landing/Navbar.tsx` -- auth-aware navbar with user dropdown
- `src/pages/Login.tsx` -- redirect to `/feed` after login; handle email confirmation redirect
- `src/pages/Index.tsx` -- redirect authenticated users to `/feed`

### Auth Flow After Changes
1. User signs up -> sees "check your email" message
2. User clicks email link -> `onAuthStateChange` fires with `SIGNED_IN` event -> auto-redirect to `/feed`
3. User logs in manually -> redirect to `/feed`
4. User visits `/` while logged in -> redirect to `/feed`
5. Navbar shows avatar + dropdown when logged in

