# Requirements Document

## Introduction

The Matchmaking & Connection Recommendations subsystem enables high-value, mutually relevant introductions between Counder Connect members by implementing a reciprocity-based matching approach. Unlike similarity-based systems, this subsystem matches members where one member's "seek" aligns with another member's "offer", ensuring value creation for both parties. The system uses dual directional embeddings (offer_vector and seek_vector), a hybrid algorithm combining rules, vector search, and weighted scoring, and generates human-readable rationales for match recommendations.

## Glossary

- **Member**: A registered user of the Counder Connect platform who has a profile and can participate in matchmaking
- **Intent**: A directional declaration (offer or seek) of what a member provides or needs, with a specific intent_type and optional sectors
- **Offer_Vector**: A 1024-dimensional normalized embedding representing what a member offers to others
- **Seek_Vector**: A 1024-dimensional normalized embedding representing what a member is seeking from others
- **Recommendation**: A suggested connection between two members based on reciprocity scoring
- **Introduction**: A formal request from one member to connect with a recommended member, requiring mutual consent
- **Connection**: An established relationship between two members who have mutually accepted an introduction
- **Complementarity**: A measure of how well one member's seek aligns with another member's offer based on intent compatibility
- **Batch_Id**: A unique identifier for a recommendation generation run, used for supersession
- **Cohort**: A conference edition that defines the matching boundary for members
- **ANN_Search**: Approximate Nearest Neighbor search using pgvector HNSW indexes
- **MMR**: Maximal Marginal Relevance diversification algorithm
- **RLS**: Row-Level Security in Postgres that scopes data access to the authenticated user

## Requirements

### Requirement 1: Member Intent Management

**User Story:** As a member, I want to declare what I offer and what I seek, so that the system can match me with complementary members.

#### Acceptance Criteria

1. THE System SHALL store each intent with direction ('offer' or 'seek'), intent_type, sectors array, and optional free_text (≤280 characters)
2. THE System SHALL support the following intent_types: 'deploying_capital', 'raising_capital', 'offering_expertise', 'seeking_expertise', 'hiring', 'seeking_role', 'offering_lp_capital', 'seeking_lps', 'partnership', 'mentoring', 'seeking_mentor'
3. THE System SHALL enforce that sectors values come from a controlled taxonomy (climate, fintech, semiconductors, biotech)
4. WHEN a member creates or updates an intent, THE System SHALL trigger an embedding recompute event (debounced to 10 minutes)
5. THE System SHALL allow a member to have multiple intents per direction

### Requirement 2: Embedding Generation and Storage

**User Story:** As the system, I want to generate and store dual directional embeddings for each member, so that I can perform semantic matching across offer and seek dimensions.

#### Acceptance Criteria

1. WHEN a member has one or more offer intents, THE Embedding_Generator SHALL construct an offer document by newline-joining each offer intent rendered as "{intent_type} in {sectors.join(', ')}: {free_text}" followed by the member's offer-side goals
2. WHEN a member has one or more seek intents, THE Embedding_Generator SHALL construct a seek document by newline-joining each seek intent rendered as "{intent_type} in {sectors.join(', ')}: {free_text}" followed by the member's seek-side goals
3. THE Embedding_Generator SHALL embed each document using a 1024-dimensional model and normalize vectors to unit length before storing
4. THE System SHALL store the embedding model provider and version in member_embeddings.model
5. WHEN a member has no intents on a side, THE System SHALL store NULL for that side's vector
6. WHEN the embedding model version changes, THE System SHALL trigger re-embedding for all members
7. FOR ALL valid member embeddings, the vector length SHALL equal 1.0 (±0.0001) (unit normalization property)

### Requirement 3: Eligibility Filtering

**User Story:** As a member, I want to only see recommendations for members who are eligible and appropriate, so that I don't waste time on incompatible matches.

#### Acceptance Criteria

1. FOR ALL candidate member B in member A's recommendation set, THE Eligibility_Filter SHALL verify that both A.matchmaking_opt_in and B.matchmaking_opt_in equal true
2. FOR ALL candidate member B in member A's recommendation set, THE Eligibility_Filter SHALL verify that B.cohort_id equals A.cohort_id
3. FOR ALL candidate member B in member A's recommendation set, THE Eligibility_Filter SHALL verify that B is not equal to A
4. FOR ALL candidate member B in member A's recommendation set, THE Eligibility_Filter SHALL verify that no row exists in connections(A, B)
5. FOR ALL candidate member B in member A's recommendation set, THE Eligibility_Filter SHALL verify that no row exists in member_blocks in either direction (A blocks B OR B blocks A)
6. FOR ALL candidate member B in member A's recommendation set, THE Eligibility_Filter SHALL verify that no row exists in member_mutes(A, B)
7. FOR ALL candidate member B in member A's recommendation set, THE Eligibility_Filter SHALL verify that both A and B each have at least 1 intent
8. FOR ALL candidate member B in member A's recommendation set, THE Eligibility_Filter SHALL verify that at least one intent compatibility matrix pairing is satisfiable in either direction

### Requirement 4: Intent Compatibility Matrix

**User Story:** As the system, I want to apply intent compatibility rules, so that I only match members with complementary needs and offerings.

#### Acceptance Criteria

1. WHEN member A seeks 'raising_capital' AND member B offers 'deploying_capital', THE Compatibility_Matrix SHALL recognize this as a valid pairing
2. WHEN member A seeks 'seeking_lps' AND member B offers 'offering_lp_capital', THE Compatibility_Matrix SHALL recognize this as a valid pairing
3. WHEN member A seeks 'seeking_expertise' with sector S AND member B offers 'offering_expertise' with sector S, THE Compatibility_Matrix SHALL recognize this as a valid pairing
4. WHEN member A seeks 'seeking_expertise' with sector S1 AND member B offers 'offering_expertise' with sector S2 AND S1 does not overlap with S2, THE Compatibility_Matrix SHALL NOT recognize this as a valid pairing
5. WHEN member A seeks 'seeking_role' AND member B offers 'hiring', THE Compatibility_Matrix SHALL recognize this as a valid pairing
6. WHEN member A seeks 'seeking_mentor' AND member B offers 'mentoring', THE Compatibility_Matrix SHALL recognize this as a valid pairing
7. WHEN member A offers 'partnership' AND member B seeks 'partnership', THE Compatibility_Matrix SHALL recognize this as a valid symmetric pairing
8. WHEN both member A and member B seek the same intent_type (e.g., both seek 'raising_capital'), THE Compatibility_Matrix SHALL NOT recognize this as a valid pairing

### Requirement 5: Vector-Based Candidate Generation

**User Story:** As the system, I want to use approximate nearest neighbor search to efficiently generate candidate recommendations, so that I can scale to large cohorts.

#### Acceptance Criteria

1. THE Candidate_Generator SHALL perform an ANN search where member A's seek_vector queries member_embeddings.offer_vector for eligible members, ordered by cosine distance, limited to CANDIDATE_N (default 200)
2. THE Candidate_Generator SHALL perform an ANN search where member A's offer_vector queries member_embeddings.seek_vector for eligible members, ordered by cosine distance, limited to CANDIDATE_N (default 200)
3. THE Candidate_Generator SHALL union and deduplicate the results from both ANN searches
4. THE System SHALL use HNSW indexes with m=16 and ef_construction=64 on offer_vector and seek_vector columns
5. THE System SHALL use cosine distance operator (<=>) for vector similarity queries
6. THE System SHALL set hnsw.ef_search to 100 for ANN queries

### Requirement 6: Feature Scoring - Complementarity

**User Story:** As the system, I want to score intent and sector alignment, so that I prioritize matches with strong reciprocity.

#### Acceptance Criteria

1. THE Complementarity_Scorer SHALL calculate intent_match as min(1, matrix_satisfied_pairs / 2)
2. THE Complementarity_Scorer SHALL calculate sector_overlap as Jaccard similarity over sectors of matched intents
3. THE Complementarity_Scorer SHALL calculate complementarity as 0.7 * intent_match + 0.3 * sector_overlap
4. THE Complementarity_Scorer SHALL return a value in the range [0, 1]
5. FOR ALL candidate pairs with no matrix pairing, complementarity SHALL equal 0

### Requirement 7: Feature Scoring - Semantic Similarity

**User Story:** As the system, I want to score semantic alignment between embeddings, so that I capture nuanced compatibility beyond explicit intents.

#### Acceptance Criteria

1. THE Semantic_Scorer SHALL calculate cosine similarity between A.seek_vector and B.offer_vector
2. THE Semantic_Scorer SHALL calculate cosine similarity between A.offer_vector and B.seek_vector
3. THE Semantic_Scorer SHALL map each cosine similarity from [-1, 1] to [0, 1] using (x + 1) / 2
4. THE Semantic_Scorer SHALL calculate the mean of mapped similarities for non-NULL vector pairs
5. WHEN a member has a NULL vector on one side, THE Semantic_Scorer SHALL exclude that side from the mean calculation
6. THE Semantic_Scorer SHALL return a value in the range [0, 1]

### Requirement 8: Feature Scoring - Context

**User Story:** As the system, I want to score shared context signals, so that I boost matches with common touchpoints.

#### Acceptance Criteria

1. THE Context_Scorer SHALL calculate sessions as min(1, shared_session_count / 3)
2. THE Context_Scorer SHALL calculate mutuals as min(1, mutual_connection_count / 5)
3. WHEN members A and B have the same region, THE Context_Scorer SHALL set region to 1
4. WHEN members A and B have different regions but the same timezone, THE Context_Scorer SHALL set region to 0.5
5. WHEN members A and B have different regions and different timezones, THE Context_Scorer SHALL set region to 0
6. THE Context_Scorer SHALL calculate context as 0.5 * sessions + 0.3 * mutuals + 0.2 * region
7. THE Context_Scorer SHALL return a value in the range [0, 1]

### Requirement 9: Feature Scoring - Serendipity

**User Story:** As the system, I want to lightly reward cross-sector matches, so that I introduce occasional diversity without compromising relevance.

#### Acceptance Criteria

1. WHEN complementarity is less than 0.5, THE Serendipity_Scorer SHALL return 0
2. WHEN semantic score is less than 0.6, THE Serendipity_Scorer SHALL return 0
3. WHEN complementarity is at least 0.5 AND semantic score is at least 0.6 AND members A and B have different primary sectors, THE Serendipity_Scorer SHALL return 1
4. WHEN complementarity is at least 0.5 AND semantic score is at least 0.6 AND members A and B have the same primary sector, THE Serendipity_Scorer SHALL return 0
5. THE Serendipity_Scorer SHALL return a value in the set {0, 1}

### Requirement 10: Feature Scoring - Activity

**User Story:** As the system, I want to prioritize recently active members, so that introductions are more likely to be responded to.

#### Acceptance Criteria

1. THE Activity_Scorer SHALL calculate activity as exp(-days_since(B.last_active_at) / 30)
2. THE Activity_Scorer SHALL return a value in the range [0, 1]

### Requirement 11: Feature Scoring - Penalty

**User Story:** As the system, I want to apply penalties for previously skipped candidates, so that I learn from member feedback.

#### Acceptance Criteria

1. WHEN member A previously skipped member B, THE Penalty_Scorer SHALL return 0.3
2. WHEN member A has not previously skipped member B, THE Penalty_Scorer SHALL return 0

### Requirement 12: Weighted Score Calculation

**User Story:** As the system, I want to compute a final score using weighted features, so that I can rank candidates by overall match quality.

#### Acceptance Criteria

1. THE Score_Calculator SHALL compute score as 0.40*complementarity + 0.30*semantic + 0.20*context + 0.05*serendipity + 0.05*activity - penalty
2. THE Score_Calculator SHALL clamp the result to the range [0, 1]
3. THE Score_Calculator SHALL filter out candidates with score less than MIN_SCORE (default 0.35)
4. WHEN fewer than MIN_RESULTS (default 3) candidates pass the MIN_SCORE threshold, THE Score_Calculator SHALL relax the filter to include the top MIN_RESULTS candidates by raw score
5. FOR ALL scored candidates, the reasons jsonb object SHALL contain matched_intents, shared_sectors, shared_sessions, mutual_connections, feature_scores, and total_score

### Requirement 13: Diversification and Ranking

**User Story:** As the system, I want to diversify recommendations, so that members see a varied set of high-quality matches rather than many similar ones.

#### Acceptance Criteria

1. THE Diversifier SHALL iteratively select candidates using greedy MMR with lambda=0.8 to maximize (lambda * score - (1 - lambda) * maxCosSim(candidate.offer_vector, alreadySelected))
2. THE Diversifier SHALL enforce that at most MAX_PER_SECTOR (default 3) candidates sharing a primary sector appear in the final list
3. THE Diversifier SHALL truncate the final list to K (default 15) recommendations
4. FOR ALL diversified recommendation lists, each candidate SHALL have a higher or equal score than all candidates not selected
5. FOR ALL diversified recommendation lists, the maximum cosine similarity between any two selected candidates' offer_vectors SHALL be minimized subject to score constraints

### Requirement 14: Rationale Generation with LLM

**User Story:** As a member, I want to see a clear explanation of why I should meet a recommended candidate, so that I can quickly assess the value of the introduction.

#### Acceptance Criteria

1. WHEN generating a rationale, THE Rationale_Generator SHALL pass only the reasons object (matched_intents, shared_sectors, shared_sessions, mutual_connections) to the LLM
2. THE Rationale_Generator SHALL use Claude with max_tokens=80 and temperature=0.3
3. THE Rationale_Generator SHALL prompt the LLM to write one concise sentence (≤35 words) explaining why two members should meet
4. THE Rationale_Generator SHALL set rationale_source to 'llm' when the LLM successfully generates a rationale
5. WHEN the LLM is unavailable, times out, or exceeds cost cap, THE Rationale_Generator SHALL use a deterministic template and set rationale_source to 'template'
6. FOR ALL generated rationales, the rationale SHALL NOT contain any fact absent from the reasons object
7. FOR ALL generated rationales, the rationale SHALL NOT mention scores, internal fields, or private free_text

### Requirement 15: Recommendation Persistence and Batch Supersession

**User Story:** As the system, I want to persist recommendations with batch supersession, so that members see fresh recommendations without duplicates.

#### Acceptance Criteria

1. WHEN persisting a new recommendation batch for member A, THE System SHALL allocate a new batch_id
2. WHEN persisting a new recommendation batch for member A, THE System SHALL mark all existing recommendations for member A with status 'pending' or 'surfaced' as 'expired'
3. WHEN persisting a new recommendation batch for member A, THE System SHALL insert new recommendations with status 'pending', the new batch_id, score, reasons, rationale, and rationale_source
4. THE System SHALL enforce a unique constraint on (member_id, candidate_id, batch_id) to prevent intra-batch duplicates
5. THE System SHALL complete batch supersession within a single database transaction

### Requirement 16: Recommendations API - Retrieval

**User Story:** As a member, I want to retrieve my personalized recommendations feed, so that I can discover valuable connections.

#### Acceptance Criteria

1. WHEN a member requests GET /api/recommendations, THE System SHALL return only recommendations with status 'pending' or 'surfaced' owned by the authenticated member
2. THE System SHALL return recommendations ordered by score descending
3. THE System SHALL support pagination via limit and cursor query parameters
4. WHEN a member views a recommendation with status 'pending', THE System SHALL transition the status to 'surfaced'
5. WHEN a member views a recommendation, THE System SHALL log a 'viewed' action to recommendation_feedback
6. THE System SHALL return candidate details including id, display_name, headline, photo_url, role, and org_type
7. THE System SHALL return reasons_summary including matched_intents, shared_sectors, and shared_sessions
8. THE System SHALL return the rationale for each recommendation

### Requirement 17: Recommendations API - Feedback

**User Story:** As a member, I want to provide feedback on recommendations, so that the system learns my preferences.

#### Acceptance Criteria

1. WHEN a member submits POST /api/recommendations/:id/feedback with action 'accepted', THE System SHALL log an 'accepted' feedback event
2. WHEN a member submits POST /api/recommendations/:id/feedback with action 'skipped', THE System SHALL log a 'skipped' feedback event and apply the skip penalty in future scoring
3. WHEN a member submits POST /api/recommendations/:id/feedback with action 'muted', THE System SHALL log a 'muted' feedback event and insert a row into member_mutes(member_id, muted_member_id)
4. WHEN a member submits feedback for a recommendation they do not own, THE System SHALL return 404
5. THE System SHALL return 200 with {"ok": true} on successful feedback submission

### Requirement 18: Introduction Request

**User Story:** As a member, I want to request an introduction to a recommended candidate, so that I can establish a connection with mutual consent.

#### Acceptance Criteria

1. WHEN a member submits POST /api/introductions with a valid recommendation_id, THE System SHALL create an introduction with state 'requested' and expires_at set to created_at + INTRO_TTL_DAYS (default 14)
2. WHEN a member has MAX_PENDING_INTROS (default 10) or more outgoing introductions in state 'requested', THE System SHALL return 429
3. WHEN a non-terminal introduction already exists between members A and B, THE System SHALL return 409 with the existing introduction id (idempotent)
4. WHEN the candidate is blocked or muted, THE System SHALL return 403
5. WHEN the members are already connected, THE System SHALL return 409
6. THE System SHALL return 201 with introduction id, state, and expires_at on successful creation

### Requirement 19: Introduction Response

**User Story:** As a member, I want to accept or decline introduction requests, so that I control who I connect with.

#### Acceptance Criteria

1. WHEN a recipient submits POST /api/introductions/:id/respond with decision 'accept', THE System SHALL transition the introduction state to 'accepted'
2. WHEN a recipient accepts an introduction, THE System SHALL create a chat channel (integrated with §9)
3. WHEN a recipient accepts an introduction, THE System SHALL create a connections row for both members
4. WHEN a recipient accepts an introduction, THE System SHALL set the introduction channel_id to the created chat channel id
5. WHEN a recipient accepts an introduction, THE System SHALL mark the sourcing recommendation as 'accepted'
6. WHEN a recipient accepts an introduction, THE System SHALL notify both members
7. WHEN a recipient submits POST /api/introductions/:id/respond with decision 'decline', THE System SHALL transition the introduction state to 'declined' without notifying the requester
8. WHEN a member who is not the recipient attempts to respond, THE System SHALL return 403
9. WHEN a member attempts to respond to an introduction not in state 'requested', THE System SHALL return 409
10. THE System SHALL return 200 with introduction id, state, and channel_id on successful response

### Requirement 20: Introduction Expiry

**User Story:** As the system, I want to expire stale introduction requests, so that the introduction queue stays relevant.

#### Acceptance Criteria

1. THE Introduction_Expiry_Job SHALL run on an hourly cron schedule
2. WHEN the job runs, THE System SHALL transition all introductions with state 'requested' and expires_at in the past to state 'expired'
3. WHEN an introduction expires, THE System SHALL NOT notify the requester

### Requirement 21: Embedding Background Job

**User Story:** As the system, I want to recompute embeddings when intents or goals change, so that recommendations stay current.

#### Acceptance Criteria

1. THE Embedding_Job SHALL trigger on 'intent.updated' or 'goal.updated' events debounced to 10 minutes
2. WHEN the job runs, THE System SHALL rebuild the member's offer and seek documents
3. WHEN the job runs, THE System SHALL call the embedding API to generate new vectors
4. WHEN the job runs, THE System SHALL upsert the vectors to member_embeddings with the current model version and updated_at timestamp
5. THE Embedding_Job SHALL use the member_id as the concurrency key

### Requirement 22: Nightly Recompute Background Job

**User Story:** As the system, I want to regenerate recommendations nightly, so that all members receive fresh matches.

#### Acceptance Criteria

1. THE Recompute_Job SHALL trigger on a nightly cron schedule (default '0 2 * * *') per cohort
2. THE Recompute_Job SHALL trigger on 'intent.updated', 'profile.updated', or 'session.rsvp.created' events debounced to 10 minutes for a single member
3. WHEN the job runs for a cohort, THE System SHALL execute the full pipeline (eligibility, candidate generation, scoring, diversification, rationale, persistence) for all members in the cohort
4. WHEN the job runs for a single member, THE System SHALL execute the full pipeline for that member only
5. THE Recompute_Job SHALL use the member_id as the concurrency key
6. THE Recompute_Job SHALL ensure embeddings are current before scoring

### Requirement 23: Daily Digest Background Job

**User Story:** As a member, I want to receive a daily notification with top recommendations, so that I stay engaged with matchmaking.

#### Acceptance Criteria

1. THE Daily_Digest_Job SHALL trigger on a daily cron schedule aligned to each cohort's timezone window
2. WHEN the job runs, THE System SHALL select the top 1-3 recommendations with status 'pending' (never-surfaced) per member
3. THE Daily_Digest_Job SHALL respect member quiet hours and notification preferences (§6)
4. WHEN recommendations are selected for a member, THE System SHALL emit notifications (web push / FCM + in-app)
5. WHEN recommendations are selected for a member, THE System SHALL transition their status from 'pending' to 'surfaced'

### Requirement 24: Matchmaking Opt-In and Privacy

**User Story:** As a member, I want to control whether I participate in matchmaking, so that I maintain privacy and consent.

#### Acceptance Criteria

1. WHEN a member sets matchmaking_opt_in to false, THE System SHALL exclude the member from all candidate sets within one recompute cycle
2. WHEN a member sets matchmaking_opt_in to false, THE System SHALL not generate recommendations for the member
3. THE System SHALL enforce RLS on all matchmaking tables scoped to auth.uid()
4. THE System SHALL use only shareable fields (matched_intents types and sectors, shared_sectors, shared_sessions titles, mutual_connections count) when generating rationales
5. THE System SHALL NOT expose private free_text, scores, or sensitive attributes in rationales

### Requirement 25: Blocking and Muting

**User Story:** As a member, I want to block or mute other members, so that I can control who can see me and who I see.

#### Acceptance Criteria

1. WHEN a member A blocks member B, THE System SHALL insert a row into member_blocks(A, B)
2. WHEN a member A is blocked by member B OR member A blocks member B, THE System SHALL exclude B from A's candidate set and A from B's candidate set
3. WHEN a member A mutes member B, THE System SHALL insert a row into member_mutes(A, B)
4. WHEN a member A mutes member B, THE System SHALL exclude B from A's candidate set (one-directional)
5. WHEN a member A mutes member B, THE System SHALL NOT exclude A from B's candidate set

### Requirement 26: Cold Start Handling

**User Story:** As a new member, I want to receive recommendations even without feedback history, so that I can start building connections immediately.

#### Acceptance Criteria

1. THE System SHALL require each member to provide at least 1 offer intent, 1 seek intent, and a short goal before generating recommendations
2. WHEN a member has no feedback history, THE System SHALL rank using only complementarity, semantic, and context features
3. WHEN a cohort has fewer than MIN_RESULTS candidates passing MIN_SCORE, THE System SHALL relax the threshold to surface the top MIN_RESULTS candidates by raw score
4. WHEN a member has no feedback and the serendipity gating thresholds are not met, THE Serendipity_Scorer SHALL return 0

### Requirement 27: Error Handling - Empty Candidate Set

**User Story:** As a member in a sparse cohort, I want to see an appropriate message when no recommendations are available, so that I understand the situation.

#### Acceptance Criteria

1. WHEN the pipeline generates zero candidates for a member, THE System SHALL persist zero recommendations for that member
2. WHEN a member with zero recommendations requests GET /api/recommendations, THE System SHALL return an empty items array

### Requirement 28: Error Handling - Embedding Failure

**User Story:** As the system, I want to gracefully handle embedding provider failures, so that temporary outages don't corrupt data.

#### Acceptance Criteria

1. WHEN the embedding API fails, THE Embedding_Job SHALL retry with exponential backoff
2. WHEN the embedding API continues to fail after retries, THE Embedding_Job SHALL skip the member for the current run
3. WHEN the embedding API fails, THE System SHALL preserve the member's last-known vectors and NOT set them to NULL

### Requirement 29: Error Handling - LLM Failure

**User Story:** As the system, I want to gracefully handle LLM failures, so that recommendations are always persisted with a rationale.

#### Acceptance Criteria

1. WHEN the LLM API fails, times out, or exceeds cost cap, THE Rationale_Generator SHALL generate a templated rationale
2. WHEN using a templated rationale, THE System SHALL set rationale_source to 'template'
3. THE System SHALL persist recommendations regardless of LLM availability

### Requirement 30: Error Handling - Model Version Change

**User Story:** As the system administrator, I want to safely handle embedding model upgrades, so that recommendations remain consistent.

#### Acceptance Criteria

1. WHEN the embedding model version changes, THE System SHALL trigger re-embedding for all members
2. THE System SHALL store the model version in member_embeddings.model
3. THE System SHALL NOT score members with different model versions together in the same cohort

### Requirement 31: Configuration Management

**User Story:** As a system administrator, I want to tune matchmaking parameters, so that I can optimize recommendation quality.

#### Acceptance Criteria

1. THE System SHALL store all tunable parameters in lib/matchmaking/config.ts
2. THE System SHALL support environment-specific overrides for all configuration parameters
3. THE System SHALL expose the following configurable parameters: candidateN, k, minScore, minResults, feature weights, skipPenalty, serendipityGate thresholds, mmrLambda, maxPerSector, introTtlDays, maxPendingIntros, embedding model and dimensions, HNSW parameters, LLM parameters, batchCron schedule, and recomputeDebounceMinutes
