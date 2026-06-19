# Design Document: Matchmaking & Connection Recommendations

## Overview

The Matchmaking & Connection Recommendations subsystem implements a reciprocity-based matching engine that surfaces high-value, mutually relevant introductions between Counder Connect members. Unlike similarity-based systems that would incorrectly pair members with identical needs, this system matches members where one member's "seek" aligns with another member's "offer"—for example, connecting an investor seeking domain expertise with a professor offering that expertise.

### Core Innovation: Dual Directional Embeddings

Every member is modeled as a **pair of directional vectors** (offer_vector and seek_vector), each capturing what the member provides or needs. Matching occurs **across directions**: a member's seek_vector queries other members' offer_vectors, and vice versa. This ensures reciprocity rather than similarity.

### System Boundaries and Integration Points

The matchmaking subsystem:
- **Reads** from §3 Auth & Profiles (member attributes, opt-in status, cohort membership)
- **Reads** from §5 Events & Scheduling (session co-attendance for shared context signals)
- **Writes** to §9 Chat (creates channels on introduction acceptance)
- **Writes** to §6 Notifications (daily digest, introduction notifications)
- **Orchestrates** via §8 Background Jobs (Inngest for batch processing)

The subsystem is isolated as a pure module with well-defined contracts, enabling future extraction to a separate service if scaling demands it.

### Key Design Principles

1. **Reciprocity over similarity**: Match complementary needs/offers, not alike members
2. **Hybrid algorithm**: Rules for eligibility, vectors for semantic search, transparent weighted scoring for ranking
3. **Batch processing**: Nightly + event-driven recompute via Inngest; no synchronous on-demand scoring
4. **Double opt-in**: All introductions require mutual consent before identity/contact exchange
5. **Pure, testable logic**: All scoring functions are pure and unit-tested; LLM used only for human-readable rationales
6. **Privacy by design**: Rationales draw only from shareable facts; RLS enforces data access boundaries


## Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRIGGER EVENTS                            │
│  • Nightly cron (per cohort)                                    │
│  • intent.updated / goal.updated (debounced 10min)              │
│  • profile.updated / session.rsvp.created (debounced 10min)     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EMBEDDING PIPELINE                            │
│  1. Build offer/seek text documents from intents + goals        │
│  2. Call embedding API (1024-dim, normalized)                   │
│  3. Upsert to member_embeddings (offer_vector, seek_vector)     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RECOMMENDATION PIPELINE                         │
│  Step 1: Eligibility Filter (SQL)                               │
│    • Opt-in, cohort boundary, no blocks/mutes/connections       │
│    • Intent compatibility matrix satisfaction                   │
│  Step 2: Candidate Generation (Vector ANN)                      │
│    • A.seek → B.offer (HNSW search, top-N=200)                 │
│    • A.offer → B.seek (HNSW search, top-N=200)                 │
│    • Union + dedupe → candidate set                             │
│  Step 3: Feature Scoring                                        │
│    • Complementarity (intent match + sector overlap)            │
│    • Semantic (cosine similarity across directions)             │
│    • Context (shared sessions, mutuals, region)                 │
│    • Serendipity (gated cross-sector bonus)                     │
│    • Activity (recency decay)                                   │
│    • Penalty (previous skips)                                   │
│  Step 4: Weighted Score                                         │
│    • score = 0.40×comp + 0.30×sem + 0.20×ctx +                │
│              0.05×seren + 0.05×act - penalty                    │
│    • Filter by MIN_SCORE (default 0.35)                         │
│  Step 5: Diversify & Rank (MMR)                                 │
│    • Greedy MMR with λ=0.8                                      │
│    • Cap MAX_PER_SECTOR (default 3)                             │
│    • Truncate to K (default 15)                                 │
│  Step 6: Rationale Generation                                   │
│    • Claude LLM (max_tokens=80, temp=0.3)                      │
│    • Fallback to template if LLM unavailable                    │
│  Step 7: Persist                                                │
│    • Batch supersession (expire old pending/surfaced)           │
│    • Insert new recommendations with batch_id                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SURFACING & INTRODUCTIONS                     │
│  • GET /api/recommendations (feed with rationales)              │
│  • Daily digest (top 1-3 fresh recommendations)                 │
│  • POST /api/introductions (request with double opt-in)         │
│  • POST /api/introductions/:id/respond (accept/decline)         │
│  • On accept: create chat channel + connections row             │
└─────────────────────────────────────────────────────────────────┘
```


### Technology Stack Alignment

| Layer | Technology | Role in Matchmaking |
|-------|-----------|---------------------|
| App Framework | Next.js 15 App Router | Route Handlers for API endpoints, Server Actions for mutations |
| Database | Supabase Postgres | All tables with RLS, pgvector extension for embeddings |
| Vector Search | pgvector + HNSW | ANN search on offer_vector/seek_vector (1024-dim) |
| Background Jobs | Inngest | Embedding recompute, nightly batch scoring, daily digest, intro expiry |
| Embeddings | Voyage-3 or OpenAI text-embedding-3-large | Generate 1024-dim normalized vectors |
| Rationale Generation | Claude (Anthropic) | LLM for human-readable match explanations |
| Auth & RLS | Supabase Auth | JWT-based auth with auth.uid() scoping all tables |
| Connection Pooling | Supavisor | Transaction pooling mode for serverless function connections |

### Module Structure

```
lib/matchmaking/
  config.ts                   # All tunables (weights, K, thresholds, model config)
  types.ts                    # TypeScript interfaces (Intent, Recommendation, etc.)
  matrix.ts                   # Intent compatibility matrix (typed map)
  embeddings.ts               # Document builder, embedding API client, normalization
  eligibility.ts              # SQL predicates (opt-in, cohort, blocks, mutes, matrix)
  candidates.ts               # Dual ANN search + union/dedupe
  scoring/
    complementarity.ts        # Intent match + sector overlap
    semantic.ts               # Cosine similarity across directions
    context.ts                # Sessions, mutuals, region
    serendipity.ts            # Gated cross-sector bonus
    activity.ts               # Recency decay
    penalty.ts                # Skip penalty lookup
    index.ts                  # Weighted scorer orchestration
  diversify.ts                # Greedy MMR + sector cap
  rationale.ts                # LLM prompt + template fallback
  pipeline.ts                 # Orchestrates Steps 2-7 + batch supersession

inngest/
  matchmaking-embed.ts        # Trigger: intent/goal updated (debounced)
  matchmaking-recompute.ts    # Trigger: nightly cron + events (debounced)
  matchmaking-dailyDigest.ts  # Trigger: daily cron per cohort timezone
  introductions-expire.ts     # Trigger: hourly cron

app/api/
  recommendations/
    route.ts                  # GET (list with pagination)
    [id]/
      feedback/
        route.ts              # POST (accepted/skipped/muted)
  introductions/
    route.ts                  # POST (request)
    [id]/
      respond/
        route.ts              # POST (accept/decline)
```


## Components and Interfaces

### Intent Management

**Component:** `lib/matchmaking/intents`

**Responsibilities:**
- Validate intent creation/updates (direction, intent_type enum, sectors from taxonomy, free_text ≤280 chars)
- Emit `intent.updated` event on change
- Provide query interface for member's intents by direction

**Interface:**
```typescript
interface Intent {
  id: string;
  member_id: string;
  direction: 'offer' | 'seek';
  intent_type: IntentType;
  sectors: string[];
  free_text?: string;
  created_at: Date;
}

type IntentType =
  | 'deploying_capital'
  | 'raising_capital'
  | 'offering_expertise'
  | 'seeking_expertise'
  | 'hiring'
  | 'seeking_role'
  | 'offering_lp_capital'
  | 'seeking_lps'
  | 'partnership'
  | 'mentoring'
  | 'seeking_mentor';

function validateIntent(intent: Partial<Intent>): Result<Intent, ValidationError>;
function getIntentsByMember(memberId: string, direction?: 'offer' | 'seek'): Promise<Intent[]>;
```

### Embedding Generator

**Component:** `lib/matchmaking/embeddings.ts`

**Responsibilities:**
- Build offer/seek text documents from intents + goals
- Call embedding API with retry + backoff
- Normalize vectors to unit length
- Upsert to member_embeddings with model version

**Interface:**
```typescript
interface EmbeddingResult {
  offer_vector: number[] | null;
  seek_vector: number[] | null;
  model: string;
}

async function generateEmbeddings(
  memberId: string,
  offerIntents: Intent[],
  seekIntents: Intent[],
  offerGoals: string,
  seekGoals: string
): Promise<EmbeddingResult>;

function buildDocument(intents: Intent[], goals: string): string;
function normalizeVector(vec: number[]): number[];
```

**Document Construction Algorithm:**
```
For direction D (offer or seek):
  1. Filter intents where direction = D
  2. For each intent I:
     - Render as "{I.intent_type} in {I.sectors.join(', ')}: {I.free_text}"
  3. Newline-join rendered intents
  4. Append D-side goals
  5. Return final document string
```


### Eligibility Filter

**Component:** `lib/matchmaking/eligibility.ts`

**Responsibilities:**
- Build SQL predicates for hard eligibility constraints
- Check intent compatibility matrix satisfaction
- Return eligible candidate IDs for a given member

**Interface:**
```typescript
interface EligibilityContext {
  memberId: string;
  cohortId: string;
  memberIntents: Intent[];
}

async function getEligibleCandidates(context: EligibilityContext): Promise<string[]>;

function checkMatrixSatisfaction(
  aIntents: Intent[],
  bIntents: Intent[]
): { satisfied: boolean; pairs: IntentPair[] };
```

**SQL Eligibility Query Structure:**
```sql
SELECT DISTINCT m.id
FROM members m
WHERE m.id != :member_id
  AND m.cohort_id = :cohort_id
  AND m.matchmaking_opt_in = true
  AND NOT EXISTS (
    SELECT 1 FROM connections c
    WHERE (c.member_a = :member_id AND c.member_b = m.id)
       OR (c.member_a = m.id AND c.member_b = :member_id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM member_blocks b
    WHERE (b.member_id = :member_id AND b.blocked_member_id = m.id)
       OR (b.member_id = m.id AND b.blocked_member_id = :member_id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM member_mutes mu
    WHERE mu.member_id = :member_id AND mu.muted_member_id = m.id
  )
  AND EXISTS (SELECT 1 FROM member_intents WHERE member_id = m.id)
  -- Matrix satisfaction checked in application layer due to complexity
```

### Intent Compatibility Matrix

**Component:** `lib/matchmaking/matrix.ts`

**Responsibilities:**
- Define intent pairing rules
- Check if two members have at least one satisfiable pairing

**Interface:**
```typescript
type IntentPairing = {
  seek: IntentType;
  offer: IntentType;
  requireSectorOverlap: boolean;
};

const COMPATIBILITY_MATRIX: IntentPairing[] = [
  { seek: 'raising_capital', offer: 'deploying_capital', requireSectorOverlap: false },
  { seek: 'seeking_lps', offer: 'offering_lp_capital', requireSectorOverlap: false },
  { seek: 'seeking_expertise', offer: 'offering_expertise', requireSectorOverlap: true },
  { seek: 'seeking_role', offer: 'hiring', requireSectorOverlap: false },
  { seek: 'seeking_mentor', offer: 'mentoring', requireSectorOverlap: false },
  // partnership is symmetric
];

function isCompatible(
  aIntent: Intent,
  bIntent: Intent
): boolean;

function findSatisfiedPairs(
  aIntents: Intent[],
  bIntents: Intent[]
): IntentPair[];
```

**Compatibility Check Algorithm:**
```
For each intent A in member A's intents:
  For each intent B in member B's intents:
    If A.direction == 'seek' AND B.direction == 'offer':
      Check COMPATIBILITY_MATRIX for (A.type, B.type)
      If found AND (!requireSectorOverlap OR sectors_overlap(A, B)):
        Return true
    If A.direction == 'offer' AND B.direction == 'seek':
      Check COMPATIBILITY_MATRIX for (B.type, A.type)
      If found AND (!requireSectorOverlap OR sectors_overlap(A, B)):
        Return true
    If A.type == 'partnership' AND B.type == 'partnership':
      Return true (symmetric)
Return false
```


### Candidate Generator

**Component:** `lib/matchmaking/candidates.ts`

**Responsibilities:**
- Execute dual ANN searches using pgvector
- Union and deduplicate results
- Return candidate set for scoring

**Interface:**
```typescript
interface CandidateContext {
  memberId: string;
  offerVector: number[] | null;
  seekVector: number[] | null;
  eligibleIds: string[];
  candidateN: number;
}

async function generateCandidates(context: CandidateContext): Promise<string[]>;
```

**Dual ANN Search Algorithm:**
```sql
-- Search 1: A's needs → others' offers
WITH seek_candidates AS (
  SELECT member_id, offer_vector <=> :a_seek_vector AS distance
  FROM member_embeddings
  WHERE member_id = ANY(:eligible_ids)
    AND offer_vector IS NOT NULL
  ORDER BY distance
  LIMIT :candidate_n
),
-- Search 2: A's value → others' needs
offer_candidates AS (
  SELECT member_id, seek_vector <=> :a_offer_vector AS distance
  FROM member_embeddings
  WHERE member_id = ANY(:eligible_ids)
    AND seek_vector IS NOT NULL
  ORDER BY distance
  LIMIT :candidate_n
)
-- Union and dedupe
SELECT DISTINCT member_id
FROM (
  SELECT member_id FROM seek_candidates
  UNION ALL
  SELECT member_id FROM offer_candidates
) candidates;
```

**Note:** Set `hnsw.ef_search = 100` at session level before queries.

### Scoring Module

**Component:** `lib/matchmaking/scoring/`

**Responsibilities:**
- Calculate individual feature scores (all pure functions)
- Combine into weighted total score
- Attach structured reasons for rationale generation

**Interface:**
```typescript
interface ScoringContext {
  memberA: MemberProfile;
  memberB: MemberProfile;
  aIntents: Intent[];
  bIntents: Intent[];
  aEmbeddings: { offer: number[] | null; seek: number[] | null };
  bEmbeddings: { offer: number[] | null; seek: number[] | null };
  sharedSessions: Session[];
  mutualConnections: number;
  previousFeedback?: RecommendationFeedback[];
}

interface FeatureScores {
  complementarity: number;
  semantic: number;
  context: number;
  serendipity: number;
  activity: number;
  penalty: number;
}

interface ScoringResult {
  score: number;
  features: FeatureScores;
  reasons: Reasons;
}

function scoreCandidate(context: ScoringContext): ScoringResult;

// Individual feature functions (all pure, unit-testable)
function computeComplementarity(
  aIntents: Intent[],
  bIntents: Intent[]
): { score: number; intentMatch: number; sectorOverlap: number; matchedPairs: IntentPair[] };

function computeSemantic(
  aOffer: number[] | null,
  aSeek: number[] | null,
  bOffer: number[] | null,
  bSeek: number[] | null
): number;

function computeContext(
  sharedSessionCount: number,
  mutualConnectionCount: number,
  aRegion: string,
  bRegion: string,
  aTimezone: string,
  bTimezone: string
): { score: number; sessions: number; mutuals: number; region: number };

function computeSerendipity(
  complementarity: number,
  semantic: number,
  aPrimarySector: string,
  bPrimarySector: string
): number;

function computeActivity(lastActiveAt: Date): number;

function computePenalty(previousFeedback: RecommendationFeedback[]): number;
```


**Feature Scoring Algorithms:**

**Complementarity:**
```
intent_match = min(1, matrix_satisfied_pairs / 2)
sector_overlap = |A_sectors ∩ B_sectors| / |A_sectors ∪ B_sectors|  // Jaccard
complementarity = 0.7 × intent_match + 0.3 × sector_overlap
```

**Semantic:**
```
cos_A_seek_B_offer = cosine_similarity(A.seek_vector, B.offer_vector)
cos_A_offer_B_seek = cosine_similarity(A.offer_vector, B.seek_vector)
// Map from [-1, 1] to [0, 1]
mapped_1 = (cos_A_seek_B_offer + 1) / 2
mapped_2 = (cos_A_offer_B_seek + 1) / 2
// Average non-NULL pairs
semantic = mean([mapped_1, mapped_2])  // skip NULL vectors
```

**Context:**
```
sessions_score = min(1, shared_session_count / 3)
mutuals_score = min(1, mutual_connection_count / 5)
region_score = if same_region then 1
               else if same_timezone then 0.5
               else 0
context = 0.5 × sessions_score + 0.3 × mutuals_score + 0.2 × region_score
```

**Serendipity (gated):**
```
if complementarity < 0.5 OR semantic < 0.6:
  serendipity = 0
else:
  serendipity = if A.primary_sector ≠ B.primary_sector then 1 else 0
```

**Activity:**
```
days_since = (now - B.last_active_at) / 86400
activity = exp(-days_since / 30)
```

**Penalty:**
```
penalty = if A previously skipped B then 0.3 else 0
```

**Weighted Score:**
```
raw_score = 0.40 × complementarity
          + 0.30 × semantic
          + 0.20 × context
          + 0.05 × serendipity
          + 0.05 × activity
          - penalty

score = clamp(raw_score, 0, 1)

// Filter
if score < MIN_SCORE (default 0.35):
  discard candidate (unless count < MIN_RESULTS, then relax)
```

### Diversifier

**Component:** `lib/matchmaking/diversify.ts`

**Responsibilities:**
- Apply greedy MMR for diversity
- Enforce sector caps
- Truncate to K

**Interface:**
```typescript
interface DiversifyContext {
  candidates: ScoringResult[];
  k: number;
  mmrLambda: number;
  maxPerSector: number;
}

function diversifyAndRank(context: DiversifyContext): ScoringResult[];
```

**Greedy MMR Algorithm:**
```
selected = []
remaining = candidates sorted by score desc

while |selected| < K and |remaining| > 0:
  best = null
  best_mmr = -∞
  
  for candidate in remaining:
    relevance = candidate.score
    max_similarity = max(
      cosine_similarity(candidate.offer_vector, s.offer_vector)
      for s in selected
    ) || 0  // 0 if selected is empty
    
    mmr_score = λ × relevance - (1 - λ) × max_similarity
    
    if mmr_score > best_mmr:
      best = candidate
      best_mmr = mmr_score
  
  // Check sector cap
  sector = best.primary_sector
  count_in_sector = count(s for s in selected where s.primary_sector == sector)
  if count_in_sector < MAX_PER_SECTOR:
    selected.append(best)
  
  remaining.remove(best)

return selected[:K]
```


### Rationale Generator

**Component:** `lib/matchmaking/rationale.ts`

**Responsibilities:**
- Generate human-readable match explanation using LLM
- Provide deterministic template fallback
- Ensure no hallucination by passing only reasons object

**Interface:**
```typescript
interface RationaleContext {
  reasons: Reasons;
  maxTokens: number;
  temperature: number;
}

interface RationaleResult {
  rationale: string;
  source: 'llm' | 'template';
}

async function generateRationale(context: RationaleContext): Promise<RationaleResult>;
function generateTemplateRationale(reasons: Reasons): string;
```

**LLM Prompt:**
```
System: You are writing a concise explanation for why two members of a professional network should meet. Write one sentence (≤35 words) using ONLY the structured facts provided. Do not invent facts. Do not mention scores or internal fields. Do not include private notes.

User: {
  "matched_intents": [
    { "a_seek": "seeking_expertise", "b_offer": "offering_expertise", "sectors": ["climate"] }
  ],
  "shared_sectors": ["climate"],
  "shared_sessions": [{ "title": "Climate Capital Summit" }],
  "mutual_connections": 2
}
```

**Template Fallback:**
```typescript
function generateTemplateRationale(reasons: Reasons): string {
  const parts: string[] = [];
  
  if (reasons.matched_intents.length > 0) {
    const first = reasons.matched_intents[0];
    parts.push(`One of you is ${humanize(first.a_seek)} and the other ${humanize(first.b_offer)}`);
  }
  
  if (reasons.shared_sectors.length > 0) {
    parts.push(`both focused on ${reasons.shared_sectors[0]}`);
  }
  
  if (reasons.shared_sessions.length > 0) {
    parts.push(`and you're both attending ${reasons.shared_sessions[0].title}`);
  }
  
  if (reasons.mutual_connections > 0) {
    parts.push(`with ${reasons.mutual_connections} mutual connections`);
  }
  
  return parts.join(', ') + '.';
}
```

### Pipeline Orchestrator

**Component:** `lib/matchmaking/pipeline.ts`

**Responsibilities:**
- Orchestrate Steps 2-7 of the recommendation pipeline
- Handle batch supersession
- Coordinate transaction boundaries

**Interface:**
```typescript
interface PipelineContext {
  memberId: string;
  cohortId?: string;  // If null, process single member
  batchId: string;
}

interface PipelineResult {
  memberId: string;
  recommendationsGenerated: number;
  errors: Error[];
}

async function runPipeline(context: PipelineContext): Promise<PipelineResult>;
async function batchSupersede(
  memberId: string,
  newBatchId: string,
  recommendations: Recommendation[]
): Promise<void>;
```

**Pipeline Steps:**
```
1. Load member profile + intents + embeddings
2. Get eligible candidates (eligibility.ts)
3. Generate candidate set (candidates.ts)
4. For each candidate:
   a. Load candidate profile + intents + embeddings
   b. Compute feature scores (scoring/)
   c. Combine into weighted score + reasons
5. Filter by MIN_SCORE (with MIN_RESULTS relaxation)
6. Diversify & rank (diversify.ts)
7. Generate rationales (rationale.ts)
8. Batch supersede + persist (transaction)
```

**Batch Supersession (transactional):**
```sql
BEGIN;

-- Mark old recommendations as expired
UPDATE recommendations
SET status = 'expired'
WHERE member_id = :member_id
  AND status IN ('pending', 'surfaced');

-- Insert new batch
INSERT INTO recommendations (
  id, member_id, candidate_id, score, reasons,
  rationale, rationale_source, status, batch_id, created_at
)
VALUES (...);  -- For each diversified recommendation

COMMIT;
```


## Data Models

### Database Schema

**member_intents**
```sql
CREATE TABLE member_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('offer', 'seek')),
  intent_type TEXT NOT NULL CHECK (intent_type IN (
    'deploying_capital', 'raising_capital', 'offering_expertise',
    'seeking_expertise', 'hiring', 'seeking_role', 'offering_lp_capital',
    'seeking_lps', 'partnership', 'mentoring', 'seeking_mentor'
  )),
  sectors TEXT[] NOT NULL DEFAULT '{}',
  free_text TEXT CHECK (length(free_text) <= 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  INDEX idx_member_intents_member_direction (member_id, direction)
);

-- RLS
ALTER TABLE member_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_intents_select ON member_intents
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY member_intents_insert ON member_intents
  FOR INSERT WITH CHECK (member_id = auth.uid());

CREATE POLICY member_intents_update ON member_intents
  FOR UPDATE USING (member_id = auth.uid());

CREATE POLICY member_intents_delete ON member_intents
  FOR DELETE USING (member_id = auth.uid());
```

**member_embeddings**
```sql
CREATE TABLE member_embeddings (
  member_id UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  offer_vector VECTOR(1024) NULL,
  seek_vector VECTOR(1024) NULL,
  model TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HNSW indexes for ANN search
CREATE INDEX idx_member_embeddings_offer_vector ON member_embeddings
  USING hnsw (offer_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_member_embeddings_seek_vector ON member_embeddings
  USING hnsw (seek_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RLS
ALTER TABLE member_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_embeddings_select ON member_embeddings
  FOR SELECT USING (member_id = auth.uid());

-- Service role only for inserts/updates (background jobs)
```

**recommendations**
```sql
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  score NUMERIC(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  reasons JSONB NOT NULL,
  rationale TEXT NOT NULL,
  rationale_source TEXT NOT NULL CHECK (rationale_source IN ('llm', 'template')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'surfaced', 'accepted', 'skipped', 'expired'
  )),
  batch_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (member_id, candidate_id, batch_id),
  INDEX idx_recommendations_member_status (member_id, status),
  INDEX idx_recommendations_member_score (member_id, score DESC)
);

-- RLS
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY recommendations_select ON recommendations
  FOR SELECT USING (member_id = auth.uid());

-- Service role only for inserts/updates
```


**recommendation_feedback**
```sql
CREATE TABLE recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('viewed', 'accepted', 'skipped', 'muted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  INDEX idx_recommendation_feedback_recommendation (recommendation_id),
  INDEX idx_recommendation_feedback_member_action (member_id, action)
);

-- RLS
ALTER TABLE recommendation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY recommendation_feedback_select ON recommendation_feedback
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY recommendation_feedback_insert ON recommendation_feedback
  FOR INSERT WITH CHECK (member_id = auth.uid());
```

**introductions**
```sql
CREATE TABLE introductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'requested' CHECK (state IN (
    'requested', 'accepted', 'declined', 'expired'
  )),
  channel_id UUID NULL REFERENCES chat_channels(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  INDEX idx_introductions_recipient_state (recipient_id, state),
  INDEX idx_introductions_requester (requester_id),
  INDEX idx_introductions_expires (expires_at) WHERE state = 'requested'
);

-- RLS
ALTER TABLE introductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY introductions_select ON introductions
  FOR SELECT USING (
    requester_id = auth.uid() OR recipient_id = auth.uid()
  );

CREATE POLICY introductions_insert ON introductions
  FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY introductions_update ON introductions
  FOR UPDATE USING (recipient_id = auth.uid());
```

**connections**
```sql
CREATE TABLE connections (
  member_a UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_b UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (member_a, member_b),
  CHECK (member_a < member_b),  -- Enforce canonical ordering
  
  INDEX idx_connections_member_a (member_a),
  INDEX idx_connections_member_b (member_b)
);

-- RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY connections_select ON connections
  FOR SELECT USING (
    member_a = auth.uid() OR member_b = auth.uid()
  );

-- Service role only for inserts (created via introduction acceptance)
```

**member_blocks**
```sql
CREATE TABLE member_blocks (
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  blocked_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (member_id, blocked_member_id),
  CHECK (member_id != blocked_member_id),
  
  INDEX idx_member_blocks_member (member_id),
  INDEX idx_member_blocks_blocked (blocked_member_id)
);

-- RLS
ALTER TABLE member_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_blocks_select ON member_blocks
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY member_blocks_insert ON member_blocks
  FOR INSERT WITH CHECK (member_id = auth.uid());

CREATE POLICY member_blocks_delete ON member_blocks
  FOR DELETE USING (member_id = auth.uid());
```

**member_mutes**
```sql
CREATE TABLE member_mutes (
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  muted_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (member_id, muted_member_id),
  CHECK (member_id != muted_member_id),
  
  INDEX idx_member_mutes_member (member_id)
);

-- RLS
ALTER TABLE member_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_mutes_select ON member_mutes
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY member_mutes_insert ON member_mutes
  FOR INSERT WITH CHECK (member_id = auth.uid());

CREATE POLICY member_mutes_delete ON member_mutes
  FOR DELETE USING (member_id = auth.uid());
```


### Reasons JSONB Schema

The `reasons` field in recommendations stores structured match information used for rationale generation:

```typescript
interface Reasons {
  matched_intents: Array<{
    a_seek: IntentType;
    b_offer: IntentType;
    sectors: string[];
  }>;
  shared_sectors: string[];
  shared_sessions: Array<{
    session_id: string;
    title: string;
  }>;
  mutual_connections: number;
  feature_scores: {
    complementarity: number;
    semantic: number;
    context: number;
    serendipity: number;
    activity: number;
  };
  total_score: number;
}
```

### Required External Tables (from §3 Auth & Profiles)

The matchmaking subsystem depends on the following columns in the `members` table:

```sql
-- Assumed to exist in members table (owned by §3)
members (
  id UUID PRIMARY KEY,
  cohort_id UUID NOT NULL,
  matchmaking_opt_in BOOLEAN NOT NULL DEFAULT false,
  role TEXT,
  seniority TEXT,
  org_type TEXT,
  region TEXT,
  timezone TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT,
  headline TEXT,
  photo_url TEXT,
  last_active_at TIMESTAMPTZ,
  ...
)
```

### Session Co-Attendance Query (from §5 Events)

To compute shared_sessions context signal:

```sql
-- Query for shared sessions between two members
SELECT s.id, s.title
FROM sessions s
INNER JOIN session_reservations sr1 ON s.id = sr1.session_id
INNER JOIN session_reservations sr2 ON s.id = sr2.session_id
WHERE sr1.member_id = :member_a_id
  AND sr2.member_id = :member_b_id;
```

### Mutual Connections Query

To compute mutual_connections context signal:

```sql
-- Count mutual connections
SELECT COUNT(DISTINCT mutual.id) AS mutual_count
FROM connections c1
INNER JOIN connections c2 ON (
  (c1.member_a = c2.member_a OR c1.member_a = c2.member_b OR
   c1.member_b = c2.member_a OR c1.member_b = c2.member_b)
)
WHERE (c1.member_a = :member_a_id OR c1.member_b = :member_a_id)
  AND (c2.member_a = :member_b_id OR c2.member_b = :member_b_id)
  AND ...  -- Exclude A and B themselves
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The matchmaking subsystem's core logic—scoring algorithms, eligibility filtering, and embedding normalization—consists of pure, deterministic functions that are excellent candidates for property-based testing. These properties verify universal invariants that should hold across all valid inputs, ensuring correctness at scale.

### Property Reflection

Before defining properties, I analyzed the acceptance criteria and identified the following patterns:

**Bounded Output Properties**: Multiple scoring functions (complementarity, semantic, context, activity) must return values in [0, 1]. Rather than test each individually, Property 1 consolidates this into a single comprehensive bounded output property for all scoring functions.

**Eligibility Constraints**: Requirements 3.1-3.8 all specify hard filters that must hold for every candidate. These combine into Property 2 (eligibility filtering completeness).

**Reciprocity vs Similarity**: Requirement 4.8 captures the core innovation. This is critical enough to warrant its own property (Property 3).

**Rationale Groundedness**: Requirements 14.6-14.7 both relate to ensuring rationales don't leak forbidden information. These combine into Property 4 (template rationale safety).

**Vector Normalization**: Requirement 2.7 specifies unit length, which is foundational for all vector operations. This becomes Property 5.

### Property 1: Scoring Functions Bounded Output

*For any* valid scoring context (intents, embeddings, profile attributes), all individual scoring functions (complementarity, semantic, context, serendipity, activity, penalty) and the final weighted score SHALL return values within their specified ranges: [0, 1] for continuous scores, {0, 1} for serendipity, and [0, 0.3] for penalty.

**Validates: Requirements 6.4, 6.5, 7.6, 8.7, 9.5, 10.2, 12.2**


### Property 2: Eligibility Filter Completeness

*For any* two members A and B, if B appears in A's eligible candidate set, then all of the following must hold: (1) both have matchmaking_opt_in = true, (2) they share the same cohort_id, (3) B ≠ A, (4) no connection exists between them, (5) neither has blocked the other, (6) A has not muted B, (7) both have at least one intent, and (8) at least one intent compatibility matrix pairing is satisfiable.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

### Property 3: Reciprocity Not Similarity

*For any* two members A and B where both have only seek intents of the same intent_type (or both have only offer intents of the same intent_type), the intent compatibility matrix SHALL recognize them as incompatible (complementarity score = 0), ensuring similarity does not create matches.

**Validates: Requirements 4.8, 6.5**

### Property 4: Template Rationale Safety

*For any* reasons object, the generated template fallback rationale SHALL only contain facts explicitly present in the reasons object (matched_intents, shared_sectors, shared_sessions, mutual_connections), and SHALL NOT contain score values, internal field names, or references to private free_text.

**Validates: Requirements 14.6, 14.7**

### Property 5: Embedding Vector Normalization

*For any* member embedding generated by the system, if the vector is non-NULL, its Euclidean length SHALL equal 1.0 within a tolerance of 0.0001 (unit normalization).

**Validates: Requirements 2.7**

### Property 6: Complementarity Formula Correctness

*For any* pair of members with intents, when intent_match and sector_overlap are computed, the complementarity score SHALL equal exactly (0.7 × intent_match + 0.3 × sector_overlap), verifying the weighted combination is applied correctly.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Semantic Mapping Monotonicity

*For any* pair of cosine similarity values c1 and c2 in [-1, 1] where c1 < c2, the mapped values (c1+1)/2 and (c2+1)/2 SHALL maintain the ordering, ensuring the semantic score preserves similarity relationships.

**Validates: Requirements 7.3, 7.4**

### Property 8: Introduction Request Idempotency

*For any* introduction request between members A and B, if a non-terminal introduction already exists, requesting again SHALL return the same introduction ID and not create a duplicate, regardless of how many times the request is repeated.

**Validates: Requirements 18.3**

### Property 9: Reasons Object Schema Completeness

*For any* scored candidate, the reasons JSONB object SHALL contain all required top-level keys (matched_intents, shared_sectors, shared_sessions, mutual_connections, feature_scores, total_score), and feature_scores SHALL contain all five scoring dimensions (complementarity, semantic, context, serendipity, activity).

**Validates: Requirements 12.5**

### Property 10: Embedding Model Version Consistency

*For any* embedding upsert operation, the stored model field SHALL match the currently configured embedding model identifier, ensuring version tracking for future re-embedding migrations.

**Validates: Requirements 21.4**

### Property 11: Error Preservation of Embeddings

*For any* member with existing non-NULL embeddings, if the embedding generation process fails and is skipped, the member's offer_vector and seek_vector SHALL remain unchanged (not set to NULL or modified), preserving last-known good data.

**Validates: Requirements 28.3**


## Error Handling

### Embedding Generation Failures

**Scenario:** External embedding API (Voyage/OpenAI) is unavailable, rate-limited, or returns errors.

**Strategy:**
- Retry with exponential backoff (3 attempts: 1s, 2s, 4s delays)
- If all retries fail, log error with member_id and skip this member for current batch
- **Preserve existing embeddings**: Never overwrite valid vectors with NULL
- Mark job as partially successful with list of skipped members
- Alert monitoring system if failure rate > 10% in a batch

**Implementation:**
```typescript
async function generateEmbeddingsWithRetry(
  doc: string,
  maxRetries = 3
): Promise<number[] | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await embeddingAPI.embed(doc);
    } catch (error) {
      if (attempt === maxRetries - 1) {
        logger.error('Embedding generation failed after retries', { doc, error });
        return null;  // Signal to skip, not to overwrite
      }
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}

// In the embedding job
if (newVector === null) {
  // Skip upsert, preserve existing data
  return { status: 'skipped', memberId };
}
```

### LLM Rationale Generation Failures

**Scenario:** Claude API timeout, rate limit, cost cap exceeded, or hallucination detected.

**Strategy:**
- Set timeout: 5 seconds per rationale request
- If timeout or error: immediately fall back to deterministic template
- If cost cap exceeded (tracked via usage meter): switch entire batch to templates
- **Never block pipeline**: Always persist recommendations with a rationale (LLM or template)
- Set `rationale_source` field appropriately for observability

**Implementation:**
```typescript
async function generateRationale(reasons: Reasons): Promise<RationaleResult> {
  if (costCapExceeded()) {
    return { rationale: generateTemplate(reasons), source: 'template' };
  }
  
  try {
    const response = await Promise.race([
      claudeAPI.generate(buildPrompt(reasons)),
      timeout(5000)
    ]);
    return { rationale: response.text, source: 'llm' };
  } catch (error) {
    logger.warn('LLM rationale failed, using template', { error });
    return { rationale: generateTemplate(reasons), source: 'template' };
  }
}
```


### Empty Candidate Sets (Sparse Cohorts)

**Scenario:** Member has no eligible candidates after filtering, or all candidates score below MIN_SCORE.

**Strategy:**
- If zero candidates pass eligibility: persist zero recommendations
- If 1-2 candidates pass but score < MIN_SCORE: relax threshold to surface top MIN_RESULTS (default 3) by score
- This ensures new/sparse cohorts still get some recommendations
- API returns empty array with helpful message: "No recommendations available yet"

**Implementation:**
```typescript
// In scoring phase
let qualifiedCandidates = scored.filter(c => c.score >= MIN_SCORE);

if (qualifiedCandidates.length < MIN_RESULTS && scored.length > 0) {
  // Cold start / sparse cohort fallback
  qualifiedCandidates = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MIN_RESULTS);
  logger.info('Relaxed MIN_SCORE threshold', {
    memberId,
    originalCount: scored.filter(c => c.score >= MIN_SCORE).length,
    relaxedCount: qualifiedCandidates.length
  });
}
```

### Model Version Mismatches

**Scenario:** Embedding model is upgraded (e.g., voyage-3 → voyage-3.5), creating mixed-model cohort.

**Strategy:**
- Store `model` field in member_embeddings
- Before scoring a cohort, check if all members have same model version
- If mismatch detected: trigger full cohort re-embedding job (service role)
- **Do not score mixed-model cohorts** (results would be semantically invalid)
- Re-embedding is a one-time migration cost, acceptable for model upgrades

**Implementation:**
```typescript
async function ensureModelConsistency(cohortId: string): Promise<boolean> {
  const models = await db.query(`
    SELECT DISTINCT e.model
    FROM member_embeddings e
    INNER JOIN members m ON e.member_id = m.id
    WHERE m.cohort_id = $1
  `, [cohortId]);
  
  if (models.length > 1) {
    logger.error('Model version mismatch in cohort', { cohortId, models });
    // Trigger re-embedding job for entire cohort
    await inngest.send({ name: 'matchmaking.reembedCohort', data: { cohortId }});
    return false;
  }
  return true;
}
```

### Database Connection Exhaustion

**Scenario:** Serverless functions exhaust Postgres connection pool.

**Strategy:**
- Use Supavisor in **transaction pooling mode** (not session mode)
- Each API route/background job uses short-lived connections
- Set connection limits per function: `pool: { max: 1 }` for Route Handlers
- Background jobs run serially per member (Inngest concurrency key = member_id)
- Monitor connection count via Supabase metrics

### Duplicate Introduction Requests

**Scenario:** User clicks "Request Introduction" multiple times (network lag, double-tap).

**Strategy:**
- Check for existing non-terminal introduction before insert
- If exists: return 409 with existing intro ID (idempotent)
- Use database transaction to prevent race conditions
- Client should disable button after first click (optimistic UI)

**Implementation:**
```typescript
async function createIntroduction(
  requesterId: string,
  recipientId: string,
  recommendationId: string
): Promise<{ id: string; status: number }> {
  return await db.transaction(async (tx) => {
    const existing = await tx.query(`
      SELECT id FROM introductions
      WHERE (requester_id = $1 AND recipient_id = $2)
         OR (requester_id = $2 AND recipient_id = $1)
      AND state IN ('requested', 'accepted')
    `, [requesterId, recipientId]);
    
    if (existing.length > 0) {
      return { id: existing[0].id, status: 409 };  // Idempotent
    }
    
    // Check MAX_PENDING_INTROS
    const pending = await tx.query(`
      SELECT COUNT(*) FROM introductions
      WHERE requester_id = $1 AND state = 'requested'
    `, [requesterId]);
    
    if (pending[0].count >= MAX_PENDING_INTROS) {
      throw new Error('MAX_PENDING_INTROS exceeded');  // 429
    }
    
    const intro = await tx.insert('introductions', {
      requester_id: requesterId,
      recipient_id: recipientId,
      recommendation_id: recommendationId,
      state: 'requested',
      expires_at: addDays(new Date(), INTRO_TTL_DAYS)
    });
    
    return { id: intro.id, status: 201 };
  });
}
```


### Blocked/Muted Member Edge Cases

**Scenario:** Member A mutes Member B while B is in A's pending recommendations, or a mutual block occurs.

**Strategy:**
- Muting/blocking triggers a recompute event for the actor (debounced)
- Next recompute removes the blocked/muted candidate from future batches
- Existing pending/surfaced recommendations remain visible until next batch (acceptable staleness)
- If member tries to request intro to blocked/muted member: API returns 403

**Implementation:**
```typescript
// In eligibility filter
const eligibleIds = await db.query(`
  SELECT id FROM members m
  WHERE ...existing eligibility...
  AND NOT EXISTS (
    SELECT 1 FROM member_mutes mu
    WHERE mu.member_id = $1 AND mu.muted_member_id = m.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM member_blocks b
    WHERE (b.member_id = $1 AND b.blocked_member_id = m.id)
       OR (b.member_id = m.id AND b.blocked_member_id = $1)
  )
`, [memberId]);
```

### Concurrent Batch Updates

**Scenario:** Two recompute jobs trigger simultaneously for same member (profile update + session RSVP).

**Strategy:**
- Use Inngest concurrency control: `concurrency: { key: 'member_id', limit: 1 }`
- Only one recompute job runs per member at a time
- Second job is queued and executes after first completes
- Batch supersession transaction prevents race conditions

### Null Vector Handling

**Scenario:** Member has only offer intents (seek_vector = NULL) or vice versa.

**Strategy:**
- One-sided members participate only on populated side
- In ANN search: skip NULL vector searches (no error, just empty result for that side)
- In semantic scoring: compute mean only over non-NULL vector pairs
- If both vectors NULL: member is ineligible (filtered in eligibility step)

**Implementation:**
```typescript
async function generateCandidates(context: CandidateContext): Promise<string[]> {
  const results: Set<string> = new Set();
  
  if (context.seekVector !== null) {
    // A's needs → others' offers
    const seekMatches = await annSearch(
      context.seekVector,
      'offer_vector',
      context.eligibleIds,
      context.candidateN
    );
    seekMatches.forEach(id => results.add(id));
  }
  
  if (context.offerVector !== null) {
    // A's value → others' needs
    const offerMatches = await annSearch(
      context.offerVector,
      'seek_vector',
      context.eligibleIds,
      context.candidateN
    );
    offerMatches.forEach(id => results.add(id));
  }
  
  return Array.from(results);
}
```


## Testing Strategy

### Dual Testing Approach

The matchmaking subsystem requires both **property-based tests** (for pure scoring logic) and **unit/integration tests** (for specific scenarios, API contracts, and database interactions). Together, these provide comprehensive coverage.

### Property-Based Testing

Property-based testing is **highly appropriate** for this feature because the core matchmaking logic consists of pure, deterministic functions (scoring algorithms, eligibility filtering, vector normalization) that operate over a large input space with universal invariants.

**Property Testing Library:** Use **fast-check** for TypeScript/Node.js environments.

**Configuration:**
- Minimum **100 iterations** per property test (due to input randomization)
- Each property test references its design document property via comment tag
- Tag format: `// Feature: matchmaking-system, Property {number}: {property_text}`

**Property Test Organization:**
```
lib/matchmaking/__tests__/
  properties/
    scoring.properties.test.ts       # Properties 1, 6, 7
    eligibility.properties.test.ts   # Property 2
    reciprocity.properties.test.ts   # Property 3
    rationale.properties.test.ts     # Property 4
    embeddings.properties.test.ts    # Properties 5, 10, 11
    reasons.properties.test.ts       # Property 9
    idempotency.properties.test.ts   # Property 8
```

**Example Property Test:**
```typescript
import fc from 'fast-check';

// Feature: matchmaking-system, Property 1: Scoring Functions Bounded Output
describe('Scoring Functions Bounded Output', () => {
  it('should return values in [0, 1] for all valid inputs', () => {
    fc.assert(
      fc.property(
        arbitraryIntentPair(),
        arbitraryEmbeddingPair(),
        arbitraryContextData(),
        (intents, embeddings, context) => {
          const result = scoreCandidate({
            memberA: context.memberA,
            memberB: context.memberB,
            aIntents: intents.a,
            bIntents: intents.b,
            aEmbeddings: embeddings.a,
            bEmbeddings: embeddings.b,
            ...context
          });
          
          // All scores must be bounded
          expect(result.features.complementarity).toBeGreaterThanOrEqual(0);
          expect(result.features.complementarity).toBeLessThanOrEqual(1);
          expect(result.features.semantic).toBeGreaterThanOrEqual(0);
          expect(result.features.semantic).toBeLessThanOrEqual(1);
          expect(result.features.context).toBeGreaterThanOrEqual(0);
          expect(result.features.context).toBeLessThanOrEqual(1);
          expect([0, 1]).toContain(result.features.serendipity);
          expect(result.features.activity).toBeGreaterThanOrEqual(0);
          expect(result.features.activity).toBeLessThanOrEqual(1);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```


**Custom Arbitraries for fast-check:**
```typescript
// Generate random intents
function arbitraryIntent(): fc.Arbitrary<Intent> {
  return fc.record({
    id: fc.uuid(),
    member_id: fc.uuid(),
    direction: fc.constantFrom('offer', 'seek'),
    intent_type: fc.constantFrom(
      'deploying_capital', 'raising_capital', 'offering_expertise',
      'seeking_expertise', 'hiring', 'seeking_role'
    ),
    sectors: fc.array(fc.constantFrom('climate', 'fintech', 'biotech'), { minLength: 1, maxLength: 3 }),
    free_text: fc.option(fc.string({ maxLength: 280 })),
    created_at: fc.date()
  });
}

// Generate random normalized vectors
function arbitraryNormalizedVector(): fc.Arbitrary<number[]> {
  return fc.array(fc.float({ min: -1, max: 1 }), { minLength: 1024, maxLength: 1024 })
    .map(vec => normalizeVector(vec));  // Ensures unit length
}

// Generate random intent pairs
function arbitraryIntentPair(): fc.Arbitrary<{ a: Intent[], b: Intent[] }> {
  return fc.record({
    a: fc.array(arbitraryIntent(), { minLength: 1, maxLength: 5 }),
    b: fc.array(arbitraryIntent(), { minLength: 1, maxLength: 5 })
  });
}
```

### Unit Testing

**Purpose:** Test specific examples, edge cases, API contracts, and integration points.

**Unit Test Organization:**
```
lib/matchmaking/__tests__/
  embeddings.test.ts        # Document building, normalization, API mocking
  eligibility.test.ts       # SQL predicate construction, specific edge cases
  matrix.test.ts            # Intent compatibility matrix, sector overlap logic
  scoring/
    complementarity.test.ts # Specific intent/sector combinations
    semantic.test.ts        # NULL vector handling, cosine mapping
    context.test.ts         # Session/mutual/region scoring examples
    serendipity.test.ts     # Gating thresholds, sector diversity
  diversify.test.ts         # MMR algorithm, sector caps
  rationale.test.ts         # Template generation, fact extraction
  pipeline.test.ts          # End-to-end pipeline mocking, batch supersession

app/api/__tests__/
  recommendations.test.ts   # GET endpoint, pagination, RLS
  feedback.test.ts          # POST feedback, mute insertion
  introductions.test.ts     # POST create, idempotency, rate limit
  respond.test.ts           # POST respond, state transitions

inngest/__tests__/
  matchmaking-embed.test.ts     # Debouncing, retry logic
  matchmaking-recompute.test.ts # Concurrency, batch supersession
  dailyDigest.test.ts           # Timezone windows, quiet hours
  introductions-expire.test.ts  # TTL expiration
```

**Example Unit Test:**
```typescript
describe('Complementarity Scorer', () => {
  it('should return 0 for no matrix pairing', () => {
    const aIntents = [
      { direction: 'seek', intent_type: 'raising_capital', sectors: ['climate'] }
    ];
    const bIntents = [
      { direction: 'seek', intent_type: 'raising_capital', sectors: ['climate'] }
    ];
    
    const result = computeComplementarity(aIntents, bIntents);
    expect(result.score).toBe(0);
  });
  
  it('should calculate sector overlap with Jaccard similarity', () => {
    const aIntents = [
      { direction: 'seek', intent_type: 'seeking_expertise', sectors: ['climate', 'fintech'] }
    ];
    const bIntents = [
      { direction: 'offer', intent_type: 'offering_expertise', sectors: ['climate', 'biotech'] }
    ];
    
    const result = computeComplementarity(aIntents, bIntents);
    // Jaccard: |{climate}| / |{climate, fintech, biotech}| = 1/3
    expect(result.sectorOverlap).toBeCloseTo(1/3, 2);
  });
});
```


### Integration Testing

**Purpose:** Test database interactions, RLS policies, external API integrations, and end-to-end workflows.

**Integration Test Organization:**
```
integration/
  database.test.ts          # HNSW index usage, RLS enforcement, batch supersession
  embeddings-api.test.ts    # Actual Voyage/OpenAI API calls (rate-limited, optional)
  llm-api.test.ts           # Claude API calls (mocked or rate-limited)
  workflow.test.ts          # Full pipeline: intent update → embed → recompute → recommendations
```

**Example Integration Test:**
```typescript
describe('RLS Enforcement', () => {
  it('should prevent member A from viewing member B recommendations', async () => {
    const { supabase: supabaseA } = await createTestMember('member-a');
    const { supabase: supabaseB } = await createTestMember('member-b');
    
    // Create recommendation for member B
    await createRecommendation({ member_id: 'member-b', candidate_id: 'member-c' });
    
    // Member A tries to query member B's recommendations
    const { data, error } = await supabaseA
      .from('recommendations')
      .select('*')
      .eq('member_id', 'member-b');
    
    expect(data).toEqual([]);  // RLS blocks cross-member access
  });
});

describe('Batch Supersession', () => {
  it('should expire old pending/surfaced recommendations on new batch', async () => {
    const memberId = 'test-member';
    const oldBatchId = 'batch-1';
    const newBatchId = 'batch-2';
    
    // Create old batch
    await createRecommendations(memberId, oldBatchId, [
      { candidate_id: 'c1', status: 'pending' },
      { candidate_id: 'c2', status: 'surfaced' },
      { candidate_id: 'c3', status: 'accepted' }
    ]);
    
    // Run batch supersession
    await batchSupersede(memberId, newBatchId, [
      { candidate_id: 'c4', score: 0.8 }
    ]);
    
    // Verify old pending/surfaced are expired
    const old = await db.query(
      'SELECT status FROM recommendations WHERE member_id = $1 AND batch_id = $2',
      [memberId, oldBatchId]
    );
    expect(old.filter(r => r.status === 'pending').length).toBe(0);
    expect(old.filter(r => r.status === 'surfaced').length).toBe(0);
    expect(old.find(r => r.candidate_id === 'c3').status).toBe('accepted');  // Preserved
  });
});
```

### Test Coverage Goals

- **Property tests:** 100% coverage of pure scoring functions, eligibility logic, vector operations
- **Unit tests:** 90%+ coverage of all modules in `lib/matchmaking/`
- **Integration tests:** All API endpoints, all RLS policies, all Inngest functions
- **End-to-end test:** Complete workflow from intent update through recommendation surfacing

### Mocking Strategy

**Mock external APIs in unit tests:**
- Embedding API: Return deterministic vectors for reproducibility
- Claude API: Return template-like responses or test error handling
- Database: Use in-memory SQLite or test Supabase project

**Use real APIs in integration tests:**
- Run against test Supabase project with isolated data
- Rate-limit external API calls (Voyage, Claude) to avoid costs
- Mark expensive tests with `@slow` tag for optional execution

### Performance Testing

**Load testing is out of scope for unit/property tests**, but the following scenarios should be manually validated:

- 1,000 member cohort recompute completes in < 10 minutes
- Single member recompute completes in < 5 seconds
- ANN search with HNSW returns top-200 in < 100ms
- API endpoint response time < 200ms (p95)


## Security Considerations

### Row-Level Security (RLS)

**Primary Authorization Boundary:** All matchmaking tables enforce RLS scoped to `auth.uid()`, ensuring members can only access their own data.

**Policy Enforcement:**
```sql
-- recommendations: members can only SELECT their own
CREATE POLICY recommendations_select ON recommendations
  FOR SELECT USING (member_id = auth.uid());

-- recommendation_feedback: members can only INSERT/SELECT their own
CREATE POLICY recommendation_feedback_select ON recommendation_feedback
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY recommendation_feedback_insert ON recommendation_feedback
  FOR INSERT WITH CHECK (member_id = auth.uid());

-- introductions: members can see intros where they are requester OR recipient
CREATE POLICY introductions_select ON introductions
  FOR SELECT USING (
    requester_id = auth.uid() OR recipient_id = auth.uid()
  );

-- Service role bypasses RLS for background jobs
```

**Defense in Depth:** Even if an API route has a bug, RLS prevents cross-member data leakage at the database level.

### Input Validation (Defense at Boundary)

All API endpoints validate inputs with **zod schemas** before processing:

```typescript
import { z } from 'zod';

const createIntroSchema = z.object({
  recommendation_id: z.string().uuid()
});

const feedbackSchema = z.object({
  action: z.enum(['accepted', 'skipped', 'muted'])
});

// In route handler
export async function POST(request: Request) {
  const body = await request.json();
  const validated = createIntroSchema.parse(body);  // Throws on invalid
  // ... proceed with validated data
}
```

**Validation Rules:**
- UUIDs: Must be valid UUID v4 format
- Enums: Must match exact enum values (direction, intent_type, action, state)
- Text: free_text ≤ 280 chars, no script injection
- Arrays: sectors must be from controlled taxonomy
- Numbers: score in [0, 1], counts ≥ 0


### Rate Limiting

**Purpose:** Prevent abuse, spam, and API exhaustion.

**Implementation:** Use **Upstash Redis** for distributed rate limiting across serverless functions.

**Rate Limits:**
```typescript
// API endpoints
POST /api/introductions
  Rate: 10 requests per minute per user
  Burst: 20 requests per minute
  Response on exceed: 429 Too Many Requests

POST /api/recommendations/:id/feedback
  Rate: 30 requests per minute per user
  Response on exceed: 429 Too Many Requests

GET /api/recommendations
  Rate: 60 requests per minute per user
  Response on exceed: 429 Too Many Requests

// Business logic limits
MAX_PENDING_INTROS = 10  // Enforced in database transaction
```

**Example Implementation:**
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true
});

export async function POST(request: Request) {
  const userId = await getUserId(request);
  const { success } = await ratelimit.limit(userId);
  
  if (!success) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  // ... proceed
}
```

### Privacy by Design

**Opt-In Matchmaking:**
- `matchmaking_opt_in` defaults to `false`
- Members must explicitly enable matchmaking
- Opting out removes member from all candidate sets within one recompute cycle

**Double Opt-In Introductions:**
- Requester sends introduction request
- Recipient must accept before any identity/contact exchange occurs
- Declines are **silent to requester** (no notification, preserves recipient privacy)
- Only after mutual acceptance: chat channel created + connection established

**Rationale Groundedness:**
- LLM prompt receives **only** the `reasons` object (matched_intents, shared_sectors, shared_sessions, mutual_connections)
- **Never** pass: raw profile, private free_text, internal scores, sensitive attributes
- Template fallback uses same restricted data
- Property tests verify no forbidden content in rationales

**No Demographic Scoring:**
- Serendipity term rewards **sector diversity**, not demographic attributes
- Age, gender, race, religion explicitly excluded from scoring
- Scoring on protected attributes is prohibited


### Right to Erasure (GDPR/POPIA Compliance)

**Cascading Deletion:** When a member account is deleted, all matchmaking data must be removed.

**Tables with CASCADE:**
```sql
-- All foreign keys use ON DELETE CASCADE
member_intents.member_id → members.id ON DELETE CASCADE
member_embeddings.member_id → members.id ON DELETE CASCADE
recommendations.member_id → members.id ON DELETE CASCADE
recommendations.candidate_id → members.id ON DELETE CASCADE
recommendation_feedback.member_id → members.id ON DELETE CASCADE
introductions.requester_id → members.id ON DELETE CASCADE
introductions.recipient_id → members.id ON DELETE CASCADE
connections.member_a → members.id ON DELETE CASCADE
connections.member_b → members.id ON DELETE CASCADE
member_blocks.member_id → members.id ON DELETE CASCADE
member_blocks.blocked_member_id → members.id ON DELETE CASCADE
member_mutes.member_id → members.id ON DELETE CASCADE
member_mutes.muted_member_id → members.id ON DELETE CASCADE
```

**Audit Logging:** Log all erasure events with timestamp for compliance reporting.

### Secrets Management

**Service Role Keys:** Stored in environment variables, never in code:
```
SUPABASE_SERVICE_ROLE_KEY  # For background jobs bypassing RLS
EMBEDDING_API_KEY          # Voyage or OpenAI
ANTHROPIC_API_KEY          # Claude
INNGEST_EVENT_KEY          # Inngest webhook verification
```

**Client-Side Security:**
- Only Supabase anon key exposed to client
- RLS enforces all authorization
- JWT tokens validated on every request

### SQL Injection Prevention

**Parameterized Queries Only:**
```typescript
// GOOD
const result = await supabase
  .from('recommendations')
  .select('*')
  .eq('member_id', userId);

// BAD (never do this)
const result = await supabase.rpc('raw_query', {
  sql: `SELECT * FROM recommendations WHERE member_id = '${userId}'`
});
```

All queries use Supabase client or parameterized prepared statements. No string interpolation into SQL.

### CORS and CSRF

**CORS:** Configure Next.js API routes to only accept requests from Counder Connect domain:
```typescript
// middleware.ts
export function middleware(request: Request) {
  const origin = request.headers.get('origin');
  const allowedOrigins = ['https://counder.com', 'https://app.counder.com'];
  
  if (!allowedOrigins.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }
  
  return NextResponse.next();
}
```

**CSRF:** Supabase Auth JWT includes CSRF protection; Server Actions use built-in Next.js CSRF tokens.


## Performance Considerations

### Connection Pooling (Critical for Serverless)

**Problem:** Each serverless function invocation opens database connections. At 3,000 concurrent users, this exhausts Postgres max_connections.

**Solution:** Use **Supavisor in transaction pooling mode**:
```typescript
// lib/db/index.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false  // Stateless for serverless
    },
    global: {
      headers: {
        // Use transaction pooling connection string
        'x-connection-mode': 'transaction'
      }
    }
  }
);
```

**Connection Limits per Function:**
- Route Handlers: `pool: { max: 1 }` (short-lived requests)
- Background jobs: `pool: { max: 5 }` (longer-running, but bounded by Inngest concurrency)

### HNSW Index Configuration

**Index Parameters:**
```sql
CREATE INDEX idx_member_embeddings_offer_vector ON member_embeddings
  USING hnsw (offer_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Query-Time Settings:**
```sql
SET hnsw.ef_search = 100;  -- Per session, before ANN queries
```

**Trade-offs:**
- `m = 16`: Moderate connectivity, good balance of accuracy/speed
- `ef_construction = 64`: Build time ~2x slower than default, but 20% better recall
- `ef_search = 100`: Query time ~50ms for 1024-dim at 1,000 members, 99%+ recall

**Performance Benchmarks (expected):**
- 1,000 members: ANN search < 100ms
- 3,000 members: ANN search < 150ms
- 10,000 members: ANN search < 250ms (future growth)

### Batch Processing Strategy

**Nightly Cohort Recompute:**
- Process members serially with Inngest concurrency: `{ key: 'member_id', limit: 1 }`
- Prevents connection exhaustion and database contention
- 1,000 member cohort: ~20 minutes total (1.2s per member × 1,000)
- Acceptable since batch runs at 2 AM (low traffic)

**Event-Driven Recompute (Debounced):**
- Intent/profile updates trigger recompute **after 10-minute debounce window**
- Prevents cascade of recomputes from rapid edits
- Single-member recompute: < 5 seconds

**Daily Digest Fan-Out:**
- Select top 1-3 recommendations per member
- Fan-out notifications via Inngest (batched)
- Rate: ~100 notifications/second via FCM/Web Push
- 1,000 members: ~10 seconds total fan-out time


### Caching Strategy

**Embedding Model Config (Rarely Changes):**
```typescript
// Cache for 1 hour in memory
let cachedEmbeddingConfig: EmbeddingConfig | null = null;
let cacheExpiry: number = 0;

export function getEmbeddingConfig(): EmbeddingConfig {
  if (cachedEmbeddingConfig && Date.now() < cacheExpiry) {
    return cachedEmbeddingConfig;
  }
  
  cachedEmbeddingConfig = {
    model: process.env.EMBEDDING_MODEL || 'voyage-3',
    dimensions: 1024
  };
  cacheExpiry = Date.now() + 3600000;  // 1 hour
  
  return cachedEmbeddingConfig;
}
```

**Candidate Profile Data (Read-Heavy):**
- Use Supabase Edge Functions cache for public profile data (display_name, headline, photo_url)
- TTL: 5 minutes
- Invalidate on profile update event

**Reasons Object (Computed Once, Read Many):**
- Stored in `recommendations.reasons` JSONB field
- No need for external cache; database provides fast JSONB access

**Not Cached:**
- Recommendations feed (always fresh from database with RLS)
- Real-time introduction state (state transitions must be immediate)

### Query Optimization

**Eligibility Filter (Most Expensive Query):**
```sql
-- Use indexes
CREATE INDEX idx_members_cohort_opt_in ON members(cohort_id, matchmaking_opt_in);
CREATE INDEX idx_connections_covering ON connections(member_a, member_b);
CREATE INDEX idx_member_blocks_covering ON member_blocks(member_id, blocked_member_id);
CREATE INDEX idx_member_mutes_member ON member_mutes(member_id);

-- Query plan should use:
-- 1. Index scan on members(cohort_id, matchmaking_opt_in)
-- 2. Anti-join on connections (indexed)
-- 3. Anti-join on member_blocks (indexed)
-- 4. Anti-join on member_mutes (indexed)

EXPLAIN ANALYZE
SELECT id FROM members
WHERE cohort_id = '...' AND matchmaking_opt_in = true
  AND NOT EXISTS (SELECT 1 FROM connections WHERE ...)
  AND NOT EXISTS (SELECT 1 FROM member_blocks WHERE ...)
  AND NOT EXISTS (SELECT 1 FROM member_mutes WHERE ...);
```

**Recommendations Retrieval (Paginated):**
```sql
-- Use composite index for cursor pagination
CREATE INDEX idx_recommendations_member_score ON recommendations(member_id, score DESC);

-- Query
SELECT * FROM recommendations
WHERE member_id = :user_id
  AND status IN ('pending', 'surfaced')
  AND score < :cursor_score  -- Cursor pagination
ORDER BY score DESC
LIMIT 20;
```

### Embedding API Cost Optimization

**Batch Embedding Requests:**
- Group multiple member embeddings into single API call (if provider supports batching)
- Reduce per-request overhead

**Cache Embeddings Aggressively:**
- Only re-embed when intents/goals change or model version changes
- Mark embeddings with `updated_at` timestamp
- Skip re-embedding if no changes detected

**Cost Estimates (Voyage-3):**
- 1024-dim embedding: ~$0.0001 per document
- 1,000 members, 2 embeddings each: ~$0.20 per full cohort re-embed
- Incremental updates (10% of members/day): ~$0.02/day

### LLM API Cost Optimization

**Use Fast Model Tier:**
- Claude Haiku (not Opus/Sonnet) for rationales
- Max tokens: 80 (short rationales)
- Temperature: 0.3 (deterministic, fewer retries)

**Cost Cap:**
- Track daily LLM spend in Redis counter
- If cap exceeded (e.g., $50/day), switch entire batch to template fallback
- Reset counter at midnight UTC

**Batch Requests:**
- Generate rationales for all candidates in a single member's batch together
- Reduces API round-trips

**Cost Estimates (Claude Haiku):**
- ~$0.0001 per rationale (80 tokens output, small input)
- 1,000 members × 15 recommendations each × $0.0001 = ~$1.50/day
- Template fallback: $0 (free)


## API Endpoint Specifications

All endpoints require valid Supabase Auth JWT. RLS enforces authorization.

### GET /api/recommendations

**Purpose:** Retrieve personalized recommendations feed with pagination.

**Authentication:** Required (JWT in Authorization header)

**Query Parameters:**
- `limit` (optional): Number of results per page (default: 20, max: 50)
- `cursor` (optional): Opaque cursor for pagination (base64-encoded score value)

**Request Example:**
```http
GET /api/recommendations?limit=20&cursor=eyJzY29yZSI6MC43NX0
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "rec-uuid",
      "candidate": {
        "id": "member-uuid",
        "display_name": "Dr. Sarah Chen",
        "headline": "Climate tech investor | Series A-B",
        "photo_url": "https://...",
        "role": "investor",
        "org_type": "vc_firm"
      },
      "score": 0.87,
      "reasons_summary": {
        "matched_intents": [
          {
            "a_seek": "seeking_expertise",
            "b_offer": "offering_expertise",
            "sectors": ["climate"]
          }
        ],
        "shared_sectors": ["climate"],
        "shared_sessions": [
          { "session_id": "session-uuid", "title": "Climate Capital Summit" }
        ],
        "mutual_connections": 2
      },
      "rationale": "You're both focused on climate—you're seeking expertise and Dr. Chen offers it, and you're both attending Climate Capital Summit.",
      "status": "pending"
    }
  ],
  "next_cursor": "eyJzY29yZSI6MC43MH0",
  "has_more": true
}
```

**Side Effects:**
- Viewing flips `status` from `pending` to `surfaced`
- Logs `viewed` action to `recommendation_feedback`

**Error Responses:**
- `401 Unauthorized`: Invalid or missing JWT
- `500 Internal Server Error`: Database error

**Implementation Notes:**
- Use cursor-based pagination (score value) for stable results
- RLS automatically filters to authenticated user's recommendations
- Only return `status IN ('pending', 'surfaced')`


### POST /api/recommendations/:id/feedback

**Purpose:** Record member feedback on a recommendation (accepted, skipped, muted).

**Authentication:** Required

**Path Parameters:**
- `id`: Recommendation UUID

**Request Body:**
```json
{
  "action": "accepted" | "skipped" | "muted"
}
```

**Request Example:**
```http
POST /api/recommendations/rec-uuid/feedback
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "action": "skipped"
}
```

**Response (200 OK):**
```json
{
  "ok": true
}
```

**Side Effects:**
- Logs action to `recommendation_feedback`
- If `action === 'muted'`: inserts row into `member_mutes(member_id, candidate_id)`
- If `action === 'skipped'`: future recomputes apply 0.3 penalty to this candidate

**Error Responses:**
- `401 Unauthorized`: Invalid or missing JWT
- `404 Not Found`: Recommendation not found or not owned by authenticated user (RLS)
- `400 Bad Request`: Invalid action value

**Rate Limit:** 30 requests/minute per user

### POST /api/introductions

**Purpose:** Request an introduction to a recommended candidate.

**Authentication:** Required

**Request Body:**
```json
{
  "recommendation_id": "rec-uuid"
}
```

**Request Example:**
```http
POST /api/introductions
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "recommendation_id": "rec-uuid"
}
```

**Response (201 Created):**
```json
{
  "id": "intro-uuid",
  "state": "requested",
  "expires_at": "2026-06-15T00:00:00Z"
}
```

**Response (409 Conflict - Idempotent):**
```json
{
  "id": "existing-intro-uuid",
  "state": "requested",
  "message": "Introduction already exists"
}
```

**Side Effects:**
- Creates introduction with `state = 'requested'`, `expires_at = now + 14 days`
- Notifies recipient (via §6 Notifications)

**Business Rules:**
- Max MAX_PENDING_INTROS (default 10) outgoing requests per member
- Only one non-terminal introduction between two members (idempotent)
- Cannot request to blocked/muted member

**Error Responses:**
- `401 Unauthorized`: Invalid JWT
- `403 Forbidden`: Candidate is blocked or muted
- `404 Not Found`: Recommendation not found or not owned by user
- `409 Conflict`: Members already connected, or non-terminal intro exists
- `429 Too Many Requests`: Exceeded MAX_PENDING_INTROS or rate limit

**Rate Limit:** 10 requests/minute per user


### POST /api/introductions/:id/respond

**Purpose:** Accept or decline an introduction request.

**Authentication:** Required

**Path Parameters:**
- `id`: Introduction UUID

**Request Body:**
```json
{
  "decision": "accept" | "decline"
}
```

**Request Example:**
```http
POST /api/introductions/intro-uuid/respond
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "decision": "accept"
}
```

**Response (200 OK - Accept):**
```json
{
  "id": "intro-uuid",
  "state": "accepted",
  "channel_id": "chat-channel-uuid"
}
```

**Response (200 OK - Decline):**
```json
{
  "id": "intro-uuid",
  "state": "declined",
  "channel_id": null
}
```

**Side Effects (Accept):**
- Sets `state = 'accepted'`, `responded_at = now`
- Creates chat channel (via §9 Chat subsystem)
- Sets `channel_id` on introduction
- Creates bidirectional `connections` row (canonical ordering: lower UUID first)
- Marks sourcing recommendation `status = 'accepted'`
- Notifies both members

**Side Effects (Decline):**
- Sets `state = 'declined'`, `responded_at = now`
- **No notification to requester** (silent decline)
- Logs to `recommendation_feedback` as implicit negative feedback

**Business Rules:**
- Only recipient can respond (checked via RLS + API logic)
- Can only respond to `state = 'requested'`
- Decline is silent to requester (privacy preserving)

**Error Responses:**
- `401 Unauthorized`: Invalid JWT
- `403 Forbidden`: Authenticated user is not the recipient
- `404 Not Found`: Introduction not found (RLS filters)
- `409 Conflict`: Introduction not in `requested` state

**Rate Limit:** 30 requests/minute per user (shared with feedback endpoint)


## Background Jobs (Inngest)

### matchmaking.embed

**Purpose:** Generate or update member embeddings when intents or goals change.

**Trigger:**
- Event: `intent.updated` or `goal.updated`
- Debounced: 10 minutes (multiple edits within window trigger only one job)

**Input:**
```typescript
{
  name: 'matchmaking.embed',
  data: {
    member_id: 'uuid'
  }
}
```

**Process:**
1. Load member's intents (offer and seek separately)
2. Load member's goals (offer-side and seek-side)
3. Build offer document (if offer intents exist)
4. Build seek document (if seek intents exist)
5. Call embedding API for each non-empty document (with retry)
6. Normalize vectors to unit length
7. Upsert to `member_embeddings` (offer_vector, seek_vector, model, updated_at)
8. If embedding fails: log error, skip member, preserve existing embeddings

**Concurrency:** `{ key: 'member_id', limit: 1 }`

**Retry:** 3 attempts with exponential backoff (1s, 2s, 4s)

**Expected Duration:** < 2 seconds per member

**Error Handling:**
- Embedding API failure → preserve existing embeddings, alert if repeated
- Network timeout → retry with backoff
- Invalid response → log error, skip member

### matchmaking.recompute

**Purpose:** Generate fresh recommendations for member(s) using the full pipeline.

**Trigger:**
- Event: `intent.updated`, `profile.updated`, `session.rsvp.created`
- Debounced: 10 minutes (per member)
- Cron: `0 2 * * *` (nightly per cohort)

**Input (Single Member):**
```typescript
{
  name: 'matchmaking.recompute',
  data: {
    member_id: 'uuid'
  }
}
```

**Input (Full Cohort):**
```typescript
{
  name: 'matchmaking.recompute',
  data: {
    cohort_id: 'uuid'
  }
}
```

**Process:**
1. If `cohort_id`: load all members in cohort; foreach member → run pipeline
2. If `member_id`: run pipeline for single member
3. **Pipeline Steps:**
   - Load member profile, intents, embeddings
   - Get eligible candidates (eligibility filter)
   - Generate candidate set (dual ANN search)
   - For each candidate: score (all features), build reasons object
   - Filter by MIN_SCORE (with MIN_RESULTS relaxation)
   - Diversify & rank (MMR + sector cap)
   - Generate rationales (LLM with template fallback)
   - Batch supersede: expire old pending/surfaced, insert new batch
4. Log metrics: candidates generated, time elapsed, errors

**Concurrency:** `{ key: 'member_id', limit: 1 }` (prevents concurrent recomputes for same member)

**Expected Duration:**
- Single member: < 5 seconds
- 1,000-member cohort: ~20 minutes (serial processing)

**Error Handling:**
- LLM failure → template fallback, continue
- Database error → retry job (Inngest automatic retry)
- Empty candidate set → persist zero recommendations (valid state)


### matchmaking.dailyDigest

**Purpose:** Select top fresh recommendations per member and send daily notification.

**Trigger:**
- Cron: Daily, aligned to each cohort's timezone window (e.g., 9 AM local time)

**Input:**
```typescript
{
  name: 'matchmaking.dailyDigest',
  data: {
    cohort_id: 'uuid'
  }
}
```

**Process:**
1. Load all members in cohort with `matchmaking_opt_in = true`
2. For each member:
   - Select top 1-3 recommendations with `status = 'pending'` (never-surfaced), ordered by score desc
   - Check member notification preferences (§6) and quiet hours
   - If preferences allow: emit notification event (web push / FCM + in-app)
   - Mark selected recommendations as `surfaced`
3. Log metrics: notifications sent, members skipped (quiet hours), errors

**Concurrency:** One job per cohort, processes members serially

**Expected Duration:**
- 1,000 members: ~10 seconds (select + fan-out via Inngest)

**Error Handling:**
- Notification delivery failure → log error, continue with next member
- No pending recommendations → skip member (no error)

**Integration with §6 Notifications:**
- Emit event: `{ name: 'notification.send', data: { member_id, type: 'daily_digest', payload: { recommendations: [...] } } }`
- §6 handles actual delivery (FCM, Web Push, in-app)

### introductions.expire

**Purpose:** Expire stale introduction requests that passed TTL without response.

**Trigger:**
- Cron: `0 * * * *` (hourly)

**Input:**
```typescript
{
  name: 'introductions.expire',
  data: {}
}
```

**Process:**
1. Query: `SELECT id FROM introductions WHERE state = 'requested' AND expires_at < now()`
2. For each: update `state = 'expired'`
3. **No notification to requester** (silent expiration)
4. Log metrics: introductions expired

**Concurrency:** Single job, runs serially

**Expected Duration:** < 5 seconds (typically few rows per hour)

**Error Handling:**
- Database error → retry job (Inngest automatic retry)


## Configuration

All tunables are centralized in `lib/matchmaking/config.ts` with environment-specific overrides.

### Configuration Schema

```typescript
// lib/matchmaking/config.ts
export interface MatchmakingConfig {
  // Candidate generation
  candidateN: number;                    // ANN top-N per side (default: 200)
  
  // Scoring
  minScore: number;                      // Minimum score threshold (default: 0.35)
  minResults: number;                    // Cold-start fallback count (default: 3)
  weights: {
    complementarity: number;             // Default: 0.40
    semantic: number;                    // Default: 0.30
    context: number;                     // Default: 0.20
    serendipity: number;                 // Default: 0.05
    activity: number;                    // Default: 0.05
  };
  skipPenalty: number;                   // Default: 0.30
  serendipityGate: {
    complementarity: number;             // Default: 0.5
    semantic: number;                    // Default: 0.6
  };
  
  // Diversification
  mmrLambda: number;                     // MMR relevance weight (default: 0.8)
  maxPerSector: number;                  // Max candidates per sector (default: 3)
  k: number;                             // Final recommendations count (default: 15)
  
  // Introductions
  introTtlDays: number;                  // Request TTL (default: 14)
  maxPendingIntros: number;              // Per-member limit (default: 10)
  
  // Embedding
  embedding: {
    model: string;                       // e.g., 'voyage-3'
    provider: 'voyage' | 'openai';
    dimensions: number;                  // Default: 1024
    apiKey: string;
  };
  
  // Vector search
  hnsw: {
    m: number;                           // Default: 16
    efConstruction: number;              // Default: 64
    efSearch: number;                    // Default: 100
  };
  
  // LLM
  llm: {
    model: string;                       // e.g., 'claude-3-haiku-20240307'
    provider: 'anthropic';
    maxTokens: number;                   // Default: 80
    temperature: number;                 // Default: 0.3
    apiKey: string;
    dailyCostCap: number;                // USD, default: 50
  };
  
  // Background jobs
  batchCron: string;                     // Nightly cron (default: '0 2 * * *')
  recomputeDebounceMinutes: number;      // Event debounce (default: 10)
  embeddingRetries: number;              // API retry count (default: 3)
}

export const MATCHMAKING_CONFIG: MatchmakingConfig = {
  candidateN: parseInt(process.env.MATCHMAKING_CANDIDATE_N || '200'),
  minScore: parseFloat(process.env.MATCHMAKING_MIN_SCORE || '0.35'),
  minResults: parseInt(process.env.MATCHMAKING_MIN_RESULTS || '3'),
  weights: {
    complementarity: 0.40,
    semantic: 0.30,
    context: 0.20,
    serendipity: 0.05,
    activity: 0.05
  },
  skipPenalty: 0.30,
  serendipityGate: {
    complementarity: 0.5,
    semantic: 0.6
  },
  mmrLambda: 0.8,
  maxPerSector: 3,
  k: 15,
  introTtlDays: 14,
  maxPendingIntros: 10,
  embedding: {
    model: process.env.EMBEDDING_MODEL || 'voyage-3',
    provider: 'voyage',
    dimensions: 1024,
    apiKey: process.env.VOYAGE_API_KEY || ''
  },
  hnsw: {
    m: 16,
    efConstruction: 64,
    efSearch: 100
  },
  llm: {
    model: process.env.LLM_MODEL || 'claude-3-haiku-20240307',
    provider: 'anthropic',
    maxTokens: 80,
    temperature: 0.3,
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    dailyCostCap: 50
  },
  batchCron: process.env.MATCHMAKING_BATCH_CRON || '0 2 * * *',
  recomputeDebounceMinutes: 10,
  embeddingRetries: 3
};
```

### Environment Variables

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
VOYAGE_API_KEY=pa-...                  # Or OPENAI_API_KEY
ANTHROPIC_API_KEY=sk-ant-...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Optional tuning
MATCHMAKING_CANDIDATE_N=200
MATCHMAKING_MIN_SCORE=0.35
MATCHMAKING_MIN_RESULTS=3
MATCHMAKING_BATCH_CRON="0 2 * * *"
EMBEDDING_MODEL=voyage-3              # Or text-embedding-3-large
LLM_MODEL=claude-3-haiku-20240307
```

### Feature Flags (Future)

For A/B testing and gradual rollout:
```typescript
// lib/matchmaking/flags.ts
export const FEATURE_FLAGS = {
  enableSerendipity: true,               // Turn on/off serendipity scoring
  enableLLMRationales: true,             // Fallback to templates if false
  enableDailyDigest: true,               // Turn on/off digest notifications
  mmrDiversification: true               // Use MMR or simple score sorting
};
```


## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Set up data models, database schema, and core pure functions.

**Tasks:**
1. Create database migration: all tables, indexes, RLS policies
2. Implement `lib/matchmaking/config.ts` with all tunables
3. Implement `lib/matchmaking/types.ts` (TypeScript interfaces)
4. Implement `lib/matchmaking/matrix.ts` (intent compatibility matrix)
5. Write unit tests for matrix logic
6. Set up test infrastructure (fast-check, test Supabase project)

**Deliverables:**
- Database schema deployed to dev environment
- Matrix logic unit-tested and validated
- Test infrastructure operational

### Phase 2: Scoring Engine (Week 3-4)

**Goal:** Implement all scoring functions as pure, testable modules.

**Tasks:**
1. Implement `lib/matchmaking/scoring/complementarity.ts` with unit tests
2. Implement `lib/matchmaking/scoring/semantic.ts` with unit tests
3. Implement `lib/matchmaking/scoring/context.ts` with unit tests
4. Implement `lib/matchmaking/scoring/serendipity.ts` with unit tests
5. Implement `lib/matchmaking/scoring/activity.ts` with unit tests
6. Implement `lib/matchmaking/scoring/penalty.ts` with unit tests
7. Implement `lib/matchmaking/scoring/index.ts` (weighted scorer)
8. Write property-based tests for all scoring functions (Properties 1, 6, 7)
9. Write unit tests for edge cases (NULL vectors, empty intents)

**Deliverables:**
- All scoring functions implemented and tested (100+ property test runs each)
- Property 1 (Bounded Output) validated across 100+ random inputs
- Scoring module ready for pipeline integration

### Phase 3: Embedding & Eligibility (Week 5)

**Goal:** Implement embedding generation and eligibility filtering.

**Tasks:**
1. Implement `lib/matchmaking/embeddings.ts` (document builder, API client, normalization)
2. Write unit tests for document building
3. Write property tests for vector normalization (Property 5)
4. Implement `lib/matchmaking/eligibility.ts` (SQL predicates, matrix check)
5. Write property tests for eligibility constraints (Property 2)
6. Implement `inngest/matchmaking-embed.ts` with retry logic
7. Test embedding job end-to-end (mock API)

**Deliverables:**
- Embedding generation functional with retry + error preservation
- Eligibility filter validated with property tests
- Properties 2, 5, 11 passing


### Phase 4: Pipeline & Diversification (Week 6-7)

**Goal:** Implement candidate generation, diversification, and pipeline orchestration.

**Tasks:**
1. Implement `lib/matchmaking/candidates.ts` (dual ANN search)
2. Test ANN queries against test data in Supabase
3. Implement `lib/matchmaking/diversify.ts` (MMR + sector cap)
4. Write unit tests for MMR algorithm
5. Implement `lib/matchmaking/rationale.ts` (LLM + template fallback)
6. Write property tests for template rationale (Properties 4, 9)
7. Implement `lib/matchmaking/pipeline.ts` (orchestrate Steps 2-7)
8. Implement batch supersession with transaction
9. Write integration tests for full pipeline
10. Implement `inngest/matchmaking-recompute.ts` with concurrency control

**Deliverables:**
- Full pipeline functional end-to-end
- Batch supersession tested (no duplicates, old expired)
- Properties 3, 4, 9 validated
- Rationale generation working (LLM + fallback)

### Phase 5: API Endpoints (Week 8)

**Goal:** Implement all API endpoints with validation, rate limiting, RLS.

**Tasks:**
1. Implement `app/api/recommendations/route.ts` (GET with pagination)
2. Implement `app/api/recommendations/[id]/feedback/route.ts` (POST)
3. Implement `app/api/introductions/route.ts` (POST with idempotency)
4. Implement `app/api/introductions/[id]/respond/route.ts` (POST)
5. Add zod validation schemas for all endpoints
6. Add rate limiting (Upstash Redis)
7. Write integration tests for all endpoints
8. Test RLS enforcement (cross-member access blocked)
9. Test idempotency (Property 8)
10. Integration with §9 Chat (create channel on accept)

**Deliverables:**
- All API endpoints functional and tested
- Rate limiting operational
- RLS verified across all tables
- Property 8 (Idempotency) passing

### Phase 6: Background Jobs & Notifications (Week 9)

**Goal:** Complete remaining background jobs and integrate with §6 Notifications.

**Tasks:**
1. Implement `inngest/matchmaking-dailyDigest.ts` with timezone handling
2. Implement `inngest/introductions-expire.ts`
3. Test debouncing on embed/recompute jobs
4. Test concurrency control (no duplicate runs)
5. Integration with §6: emit notification events
6. Test end-to-end: intent update → embed → recompute → digest → notification

**Deliverables:**
- All background jobs operational
- Daily digest tested with timezone windows
- Introduction expiry functional
- Full event-driven workflow validated

### Phase 7: Testing & Polish (Week 10)

**Goal:** Achieve comprehensive test coverage and fix edge cases.

**Tasks:**
1. Run all property tests (11 properties × 100 iterations)
2. Achieve 90%+ unit test coverage
3. Run integration tests against staging Supabase
4. Load test: 1,000-member cohort recompute
5. Test error scenarios: API failures, NULL vectors, empty cohorts
6. Security audit: RLS, input validation, secrets management
7. Performance profiling: query EXPLAIN, connection pool monitoring
8. Documentation: README, API docs, deployment guide

**Deliverables:**
- All 11 correctness properties validated
- 90%+ test coverage
- Load test results: < 20 min for 1,000 members
- Security audit passed
- Production-ready codebase

### Phase 8: Deployment & Monitoring (Week 11)

**Goal:** Deploy to production and establish observability.

**Tasks:**
1. Deploy database migrations to production Supabase
2. Deploy Next.js app to Vercel (production)
3. Deploy Inngest functions
4. Configure monitoring: Sentry (errors), PostHog (analytics)
5. Set up alerts: embedding failures, LLM cost cap, RLS violations
6. Run smoke tests on production
7. Enable for small cohort (beta testing)
8. Monitor metrics: recommendation→intro rate, intro→accept rate

**Deliverables:**
- Matchmaking system live in production
- Monitoring and alerting operational
- Beta cohort receiving recommendations
- Metrics dashboard tracking key KPIs


## Summary

The Matchmaking & Connection Recommendations subsystem implements a sophisticated reciprocity-based matching engine that connects Counder Connect members based on complementary needs and offerings, not similarity. This design document provides a comprehensive technical blueprint for implementation.

### Key Design Decisions

1. **Dual Directional Embeddings**: Every member is modeled as an (offer_vector, seek_vector) pair, enabling semantic matching across directions. This is the core innovation that ensures reciprocity.

2. **Hybrid Algorithm**: Combines rules (eligibility, compatibility matrix), vectors (ANN search with pgvector HNSW), and transparent weighted scoring for explainable, tunable results.

3. **Pure, Testable Logic**: All scoring functions are pure and unit-tested with property-based testing (fast-check, 100+ iterations per property). This ensures correctness and enables confident tuning.

4. **Batch Processing**: Recommendations are generated nightly + event-driven (debounced) via Inngest, not on-demand. This architecture scales efficiently and avoids connection exhaustion.

5. **Privacy by Design**: Double opt-in introductions, RLS on all tables, LLM rationales grounded only in shareable facts, silent declines.

6. **Error Resilience**: LLM template fallback, embedding preservation on failure, empty cohort handling, idempotent APIs.

### Validation Approach

The design includes **11 correctness properties** validated via property-based testing:
- Bounded outputs (all scorers return [0, 1])
- Eligibility completeness (all constraints enforced)
- Reciprocity not similarity (core principle)
- Rationale safety (no forbidden content)
- Vector normalization (unit length)
- Formula correctness (weighted combinations)
- Idempotency (duplicate requests handled)
- Schema completeness (reasons object)
- Version consistency (model tracking)
- Error preservation (embeddings protected)

These properties provide mathematical guarantees that hold across all valid inputs, verified through 100+ randomized test cases per property.

### Performance Characteristics

- **Single member recompute**: < 5 seconds
- **1,000-member cohort**: ~20 minutes (nightly batch)
- **ANN search**: < 100ms for 1,000 members (HNSW with ef_search=100)
- **API response time**: < 200ms p95 (with connection pooling)
- **Embedding cost**: ~$0.20 per full cohort re-embed (Voyage-3)
- **LLM cost**: ~$1.50/day for 1,000 members × 15 recs (Claude Haiku)

### Integration Points

- **§3 Auth & Profiles**: Reads member attributes, opt-in status, cohort
- **§5 Events**: Reads session co-attendance for context signals
- **§6 Notifications**: Emits events for daily digest, introduction notifications
- **§8 Background Jobs**: Orchestrates via Inngest (embed, recompute, digest, expire)
- **§9 Chat**: Creates channels on introduction acceptance

### Success Criteria

The implementation is considered successful when:
1. All 11 correctness properties pass 100+ iterations
2. 90%+ test coverage (unit + integration)
3. All API endpoints functional with RLS enforcement
4. Full event-driven workflow operational (intent update → embed → recompute → digest)
5. 1,000-member cohort recompute completes in < 20 minutes
6. Beta cohort reports high-quality recommendations (measured by intro→accept rate)

This design document serves as the definitive technical specification for building the matchmaking subsystem. All implementation decisions should reference back to this document for consistency and correctness.

---

**Document Version:** 1.0  
**Last Updated:** June 2026  
**Status:** Ready for Implementation

