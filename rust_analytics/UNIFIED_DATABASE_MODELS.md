# Unified Database Models for Rust Analytics

## Overview

This unified database model layer (`src/db/models/`) is the **single source of truth** for all database structures in the rust_analytics service. These models are designed to mirror the Prisma schema from the backend, eliminating code duplication and maintaining consistency.

## Structure

```
src/db/models/
├── mod.rs                 # Main module with re-exports
├── user.rs               # User-related models
├── assessment.rs         # Assessment, Question, QuizAttempt models
├── course.rs             # Course, Unit, CourseProgress models
├── learning.rs           # LearningPath, LearningGoal, LearningHistory models
└── engagement.rs         # StudyEvent, StudySession, UserActivity models
```

## Key Principles

1. **Single Source of Truth**: All database models are defined here and re-exported from `lib.rs`
2. **Alignment with Prisma**: Each model mirrors the corresponding Prisma schema definition
3. **No Duplication**: Old redundant model definitions in `modules/analytics/` should be removed and replaced with imports from `db::models`
4. **Clear Dependencies**: Related models are organized by domain (user, assessment, course, learning, engagement)

## Usage

### Before (Duplicated Models)
```rust
// OLD: models defined in multiple places
use modules::analytics::data_models::CourseProgress;
use modules::analytics::learning::CourseProgress as LearningCourseProgress;
use modules::analytics::models::course_models::CourseProgress as CourseModelProgress;
```

### After (Unified Models)
```rust
// NEW: single import from db::models
use crate::db::models::course::CourseProgress;
// or use the re-export from lib.rs
use crate::CourseProgress;
```

## Migration Guide

When refactoring existing code:

1. **Remove** old model definitions from `modules/analytics/data_models.rs` and `modules/analytics/learning/learning_analytics.rs`
2. **Update** imports to use `crate::db::models::<domain>::<ModelName>`
3. **Clean up** duplicate struct definitions in other files

## Key Models

### Assessment Models
- `Question` - Quiz question with difficulty and tags
- `QuizAttempt` - User's quiz attempt with score and timing
- `QuizQuestion` - Mapping between quizzes and questions
- `UserResponse` - Individual question responses

### Course Models
- `Course` - Course definition with metadata
- `CourseEnrollment` - User enrollment status
- `CourseProgress` - User's progress in a course
- `Unit` - Course unit/module
- `UnitProgress` - User's progress in a unit
- `Material` - Course materials (video, article, etc.)
- `CaseAttempt` - Clinical case attempt

### Learning Models
- `LearningPath` - Learning path definition with structure
- `LearningPathProgress` - User's progress in a path
- `LearningGoal` - User's learning goals
- `LearningHistory` - Historical learning activity
- `LearningSuggestion` - Recommended materials
- `UserLearningAnalytics` - Aggregated user stats

### Engagement Models
- `StudyEvent` - Discrete study events (quiz attempt, course view, etc.)
- `StudySession` - Continuous study session tracking
- `UserActivity` - General activity tracking
- `EngagementMetrics` - Aggregated engagement statistics

## Benefits

✅ **Consistency**: All database operations use the same struct definitions  
✅ **Maintainability**: Changes to the database schema need to be updated in only one place  
✅ **Code Organization**: Clear separation between database models and business logic  
✅ **Type Safety**: Strong typing ensures correctness at compile time  
✅ **Documentation**: Co-located with usage in the `db` module  

## Next Steps

1. Remove duplicate model definitions from `modules/analytics/`
2. Update all imports throughout the codebase
3. Run tests to ensure no regressions
4. Consider using a code generator to sync with Prisma schema automatically
