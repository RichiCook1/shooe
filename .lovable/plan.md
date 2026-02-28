

# RunReview – Social Review Platform for Running Shoes

## Overview
A full-stack social review platform where runners share shoe reviews with photos, tags, and stats. Includes a public review flow, Instagram-style profiles, a social feed, and a full admin dashboard. Built on Lovable Cloud with AI-powered shoe detection.

---

## Phase 1: Foundation & Database
Set up Lovable Cloud with the complete database schema:
- **Users & Profiles** – auth, demographics, running profile, foot details
- **Brands & Models** – structured shoe database with specs (drop, stack height, weight, MSRP)
- **Reviews** – linked to users and models, with media, tags, distance, location, terrain
- **Tags** – dynamic positive/negative tags stored in a tags table (admin-editable)
- **Social tables** – follows, likes, comments
- **Storage** – buckets for shoe photos, profile photos, and review media

Seed with **~20 demo users** and **~50+ reviews** across popular brands (Nike, Hoka, Brooks, Salomon, ASICS, New Balance, etc.) with realistic running profiles and review content.

---

## Phase 2: Public Landing Page & Review Flow
- **Landing page** – clean, athletic design (Strava/Instagram inspired) with hero section, featured reviews, and two CTAs: "Log In / Sign Up" and "Leave a Review"
- **Multi-step review flow** (no login required):
  1. **Upload Media** – mobile-first photo upload (shoe photo required, optional environment/action shots)
  2. **AI Shoe Detection** – send shoe image to Lovable AI (Gemini vision) to suggest brand/model with confidence scores; fallback to manual input
  3. **Run Details** – optional distance, location, terrain type
  4. **Tag & Review** – select positive/negative tags (dynamic from DB), optional written review
  5. **Account CTA** – prompt to sign up to save review to profile, or continue as guest

---

## Phase 3: Authentication & Sign-Up
- Email + password authentication via Lovable Cloud
- **Modular sign-up flow** collecting:
  - Basic info (email, username, password)
  - Demographics (age, height, weight, foot size/width) – optional
  - Running profile (weekly volume, running types, goals, terrain) – optional
- Guest reviews get attached to account upon sign-up
- Login/logout with session management

---

## Phase 4: User Profiles (Instagram-Style)
- **Profile page** with photo, bio, running stats, shoe preferences
- **Review grid** – visual grid of all user reviews with shoe photos
- **Follow/unfollow** system with follower/following counts
- **Public profiles** – viewable by anyone
- Like and comment on reviews

---

## Phase 5: Social Feed
- Personalized feed showing:
  - Reviews from followed users
  - Trending shoe reviews
  - Recommended reviews based on running profile, terrain, and shoe preferences
- Sort by most recent or most relevant
- Infinite scroll

---

## Phase 6: Repeat Reviews & Shoe Timeline
- Users can review the same shoe multiple times
- **Shoe timeline view** showing how opinions evolve over distance (e.g., at 50km, 200km, 500km)
- Timestamped review history per shoe per user

---

## Phase 7: Admin Dashboard
- **CRM** – view all users with demographics, running profiles, engagement metrics; export to CSV/Excel
- **Review Analytics** – reviews per brand/model, tag frequency analysis, terrain breakdown, engagement rates, geographic data
- **Field Manager** – dynamically add/edit/remove positive tags, negative tags, running profile questions, terrain options, volume ranges, and goal options
- **Shoe Database Manager** – CRUD for brands and models with all specs
- Charts and data visualizations using Recharts

---

## Design Direction
- Minimal, sport-focused aesthetic
- Dark/light mode support
- High-contrast UI with clean typography
- Mobile-first responsive design
- Instagram-like profile grid layouts
- Strava-inspired activity and stats visuals
- Accent color: energetic coral/orange paired with dark neutrals

