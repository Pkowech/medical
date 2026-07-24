# Multilayer Integration Testing Guide

## 🎯 Integration Architecture

```
Frontend Layer
├─ TopicViewer.tsx
│  ├─ Materials display
│  └─ Quiz trigger
├─ TopicQuiz.tsx (dialog)
│  └─ Question fetching & submission
├─ RecommendationsWidget.tsx
│  └─ Personalized learning paths
└─ SpacedRepetitionWidget.tsx
   └─ Due cards for review

Frontend Services
├─ quizProgressIntegration.ts (EVENT CHAIN ORCHESTRATOR)
│  ├─ Quiz completion handling
│  ├─ Progress sync
│  ├─ Recommendation refresh
│  └─ Spaced rep update
├─ progressService.ts
│  └─ Backend progress sync
├─ learningPathService.ts
│  └─ Recommendation fetching
└─ flashcardsService.ts
   └─ Spaced repetition data

Backend NestJS
├─ quiz.controller.ts
│  ├─ GET /quiz/topic/:topicId
│  └─ POST /quiz/topic/:topicId/submit
├─ progress.controller.ts
│  ├─ POST /progress/sync
│  └─ GET /progress/dashboard/:userId
├─ learning-paths.controller.ts
│  ├─ GET /learning-paths/discovery/personalized
│  ├─ GET /learning-paths/discovery/trending
│  └─ GET /learning-paths/my-progress
└─ flashcards.controller.ts
   ├─ GET /flashcards/due/:userId
   └─ POST /flashcards/update/:cardId

Backend Services
├─ quiz.service.ts
│  ├─ submitTopicQuiz() ✅
│  ├─ getQuestionsByTopic() ✅
│  └─ Scoring logic
├─ progress.service.ts
│  ├─ updateUnitMaterialTopicProgress()
│  ├─ calculateCourseProgress()
│  └─ Emit progress.updated event
├─ learning-path-recommendations.service.ts
│  ├─ getRecommendations()
│  ├─ enrichRustRecommendations()
│  └─ Call Rust gRPC
└─ flashcards.service.ts
   ├─ getDueCards()
   ├─ updateCard() (SM-2)
   └─ Risk analysis

Rust Analytics (gRPC)
├─ recommendation_service.rs
│  ├─ get_recommendations()
│  ├─ get_collaborative_recommendations()
│  └─ generate_next_steps()
└─ learning_service.rs
   ├─ User mastery calculation
   └─ Goal analytics

Database (PostgreSQL + Redis)
├─ progress table (quiz scores, completion %)
├─ progress_event journal (audit trail)
├─ flashcard tables (SM-2 data)
├─ learning_paths table (path definitions)
└─ Redis cache layer (15-min TTL)
```

## 🔄 Event Chain Flow

### Scenario: User Completes Topic Quiz

```
1. User takes quiz in TopicQuiz component
   └─ Frontend: GET /quiz/topic/{topicId}
      Backend: quiz.service.getQuestionsByTopic()
      Rust: (cached or fetched)

2. User submits quiz answers
   └─ Frontend: POST /quiz/topic/{topicId}/submit
      Backend: quiz.service.submitTopicQuiz()
      Result: { score: 85, feedback: "..." }

3. TopicViewer.onComplete() fired with score
   └─ Frontend: quizProgressIntegration.handleQuizCompletion()
      ├─ STEP 1: progressService.updateUnitProgress()
      │  └─ Backend: POST /progress/sync
      │     └─ Progress Service emits 'progress.updated' event
      │
      ├─ STEP 2: updateSpacedRepetition()
      │  └─ Trigger SM-2 calculation
      │     └─ If score < 70: quality = 1 (immediate review)
      │     └─ If score >= 80: quality = 4 (extend interval)
      │
      ├─ STEP 3: refreshRecommendations()
      │  └─ Clear cache: sessionStorage.removeItem('recommendations-userId')
      │  └─ Frontend: learningPathService.getRecommendedPaths()
      │     └─ Backend: GET /learning-paths/discovery/personalized
      │        └─ NestJS: Call learningPathRecommendationsService
      │           └─ Rust gRPC: getRecommendationsAI()
      │              └─ Result: Updated recommendations based on new mastery
      │
      └─ STEP 4: createReviewFlashcards()
         └─ If score < 80: Create flashcards for weak questions
            └─ Backend: POST /flashcards/create
               └─ Flashcard Service: SM-2 initialization

4. Widgets re-fetch data (auto-refresh)
   └─ RecommendationsWidget: Shows new recommended paths
   └─ SpacedRepetitionWidget: Shows updated due cards
   └─ Progress Dashboard: Updates progress stats
```

## ✅ Test Cases

### Test 1: Quiz Completion Event Chain
**Objective:** Verify complete flow from quiz to recommendations update

**Setup:**
1. Enroll in "Pharmacology Basics" course
2. Navigate to Topic 1 under Unit 1
3. Study all materials (click "Study Now" on each)

**Test Steps:**
```
1. Click "Take Topic Quiz" button
2. Answer all questions (aim for 85% score)
3. Click "Submit Quiz"
4. Verify toast shows: "Great! You scored 85% on this topic quiz"
5. Verify progress updates locally (Zustand store)
6. Wait 1 second for integration to complete
7. Navigate to Progress Dashboard
8. Verify "Recommended For You" widget updated with new paths
9. Verify "Due for Review" widget shows new cards (if score < 80)
```

**Success Criteria:**
- ✅ Quiz score displays correctly
- ✅ Progress local state updates
- ✅ Backend progress sync completes without errors
- ✅ Recommendations refresh with new data
- ✅ Spaced repetition cards created/updated
- ✅ No console errors
- ✅ All API calls return 200/201 status

**Test 2: Learning Path Recommendations Widget**
**Objective:** Verify personalized recommendations display correctly

**Test Steps:**
```
1. Complete at least 3 topics with good scores (>= 80%)
2. Navigate to Progress Dashboard
3. Scroll to "Recommended For You" section
4. Verify:
   - Widget displays 5 or fewer paths
   - Each path shows: title, description, difficulty, duration
   - "Start" button is clickable
   - No loading spinner (data loaded)
5. Click "Start" on a recommended path
6. Verify navigation to /learning-paths/{id}
```

**Success Criteria:**
- ✅ Recommendations display without errors
- ✅ Recommendations are based on mastery/specialization
- ✅ Paths have valid metadata (title, description, difficulty)
- ✅ Navigation works
- ✅ Average response time < 500ms (with caching)

**Test 3: Spaced Repetition Widget**
**Objective:** Verify due cards and risk topics display correctly

**Test Steps:**
```
1. Create flashcards by completing quizzes with < 80% score
2. Navigate to Progress Dashboard
3. Scroll to "Due for Review" section
4. Verify displays:
   - Due Today count
   - Upcoming count
   - Total count
   - Review Progress bar
   - High Risk Topics (if any)
5. Click "Start Review Session"
6. Verify navigation to /flashcards
```

**Success Criteria:**
- ✅ Statistics accurate and up-to-date
- ✅ Review progress bar displays correctly
- ✅ High-risk topics listed if present
- ✅ Response time < 300ms
- ✅ SM-2 algorithm data consistent

**Test 4: Material Progress Tracking**
**Objective:** Verify material viewing is tracked and influences spaced rep

**Test Steps:**
```
1. Open a topic with materials
2. Click "Study Now" on first material
3. Wait 2-3 seconds in preview (simulates viewing)
4. Click close button or outside to close
5. Verify no console errors
6. Check backend logs for progress.updated event
7. Verify material marked as completed in progress
```

**Success Criteria:**
- ✅ Material preview modal displays
- ✅ Close triggers progress sync
- ✅ Backend logs show material completion
- ✅ Progress dashboard reflects new completion

**Test 5: Rust gRPC Connectivity**
**Objective:** Verify Rust analytics service works correctly

**Test Steps:**
```
1. Start backend: npm run start
2. Verify Rust service is running on port 50051
3. In backend logs, verify gRPC channel connection
4. Make recommendation request: GET /learning-paths/discovery/personalized
5. Check response includes Rust-generated recommendations
6. Monitor response time (should be < 1000ms with cache)
```

**Success Criteria:**
- ✅ Rust service connects without errors
- ✅ Recommendations include Rust-calculated scores
- ✅ Caching works (second request < 100ms)
- ✅ Fallback to empty array if Rust fails

## 🔍 Debugging Guide

### Issue: "Failed to sync quiz completion"
**Possible Causes:**
1. Backend progress service not running
2. User ID not found in session
3. Topic/Unit/Course IDs invalid
4. Redis connection issues

**Debug Steps:**
```bash
# Check backend logs for errors
npm run logs

# Verify progress endpoint works
curl -X GET http://localhost:3002/v1/progress/dashboard/{userId} \
  -H "Authorization: Bearer {token}"

# Check Redis connectivity
redis-cli ping  # should return PONG

# Clear progress cache
redis-cli FLUSHDB
```

### Issue: "Recommendations not updating"
**Possible Causes:**
1. Rust gRPC service not running
2. Recommendations cache not invalidated
3. User has insufficient mastery data
4. Specialization filtering too strict

**Debug Steps:**
```bash
# Check Rust service status
ps aux | grep rust  # Look for analytics process

# Test Rust directly (if available)
grpcurl -plaintext list localhost:50051

# Clear cache manually
curl -X DELETE http://localhost:6379/recommendations-{userId}

# Check NestJS logs for gRPC errors
npm run logs | grep gRPC
```

### Issue: "Spaced repetition cards not showing"
**Possible Causes:**
1. No flashcards created yet
2. All cards have future review dates
3. Flashcards service not initialized
4. IndexedDB corrupted on client

**Debug Steps:**
```bash
# Clear IndexedDB (browser DevTools)
Right-click page → Inspect → Application → Storage → IndexedDB → medical-flashcards-db → Delete

# Check flashcard counts
curl -X GET http://localhost:3002/v1/flashcards/overview/{userId} \
  -H "Authorization: Bearer {token}"

# Check high-risk topics
curl -X GET http://localhost:3002/v1/flashcards/high-risk-topics/{userId} \
  -H "Authorization: Bearer {token}"
```

### Issue: "Event chain not completing"
**Possible Causes:**
1. Integration service crashed
2. Timeout on progress sync
3. Promise chain broken somewhere
4. User session expired

**Debug Steps:**
```bash
# Add debug logging to TopicViewer
// In onComplete callback:
console.log('[DEBUG] Quiz completed:', { score, topicId, courseId });
console.log('[DEBUG] Integration status:', quizProgressIntegration.getIntegrationStatus());

# Monitor network requests in DevTools
- Check all XHR requests complete successfully
- Look for failed /progress/sync requests
- Verify /learning-paths/discovery/personalized returns data

# Check session validity
console.log('[DEBUG] Session:', session);
```

## 📊 Performance Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| Quiz submission | < 500ms | - |
| Progress sync | < 300ms | - |
| Recommendation refresh | < 1000ms | - |
| Spaced rep update | < 200ms | - |
| Dashboard load | < 2000ms | - |
| Recommendations cache hit | < 100ms | - |

## 🚀 Integration Checklist

- [ ] Quiz endpoints working (GET /quiz/topic/{id}, POST /quiz/topic/{id}/submit)
- [ ] Quiz service scoring logic verified
- [ ] Progress sync endpoint working
- [ ] Progress events emitted correctly
- [ ] Rust gRPC service connected
- [ ] Recommendations calculated and returned
- [ ] Frontend event chain executes
- [ ] Widgets display on progress dashboard
- [ ] Spaced repetition data accurate
- [ ] End-to-end test passed (all 5 test cases)
- [ ] Performance targets met
- [ ] Error handling graceful
- [ ] Cache invalidation working
- [ ] Offline behavior tested

## 🔗 Related Services

- Quiz Service: `/medical/backend/src/modules/education/assessment/services/quiz.service.ts`
- Progress Service: `/medical/backend/src/modules/education/courses/services/progress.service.ts`
- Learning Paths Service: `/medical/backend/src/modules/education/courses/services/learning-paths.service.ts`
- Integration Health: `/medical/backend/src/common/services/integration-health.service.ts`
- Quiz Progress Integration: `/medical/frontend/src/features/learning-management/services/quizProgressIntegration.ts`
