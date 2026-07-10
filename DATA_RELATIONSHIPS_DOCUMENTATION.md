# Medical Platform - Data Relationships Documentation

## 1. COURSE & MATERIALS Relationship

### Hierarchy
```
CourseCategory (hierarchical - can have parent categories)
    └── Course (belongs to one category)
            └── Unit (chapters within course)
                    └── Material (PDFs, books, files)
                    └── Topic (subtopics)
                    └── Quiz
```

### Database Structure
```prisma
model Course {
  id          String
  categoryId  String?          // Points to CourseCategory
  category    CourseCategory?  @relation(...)
  units       Unit[]           // One-to-many: course has many units
  materials   Material[]       // One-to-many: course has many materials
  // ... other fields
}

model Material {
  id          String
  courseId    String?          // Direct link to course
  unitId      String?          // Link to specific unit in course
  topicId     String?          // Link to topic
  type        MaterialType     // PDF, WORD, VIDEO, etc.
  fileId      String?          // Link to File record (in R2)
  
  course      Course?          @relation(...)
  unit        Unit?            @relation(...)
  topic       Topic?           @relation(...)
  file        File?            @relation(...)
}
```

### Association Path
When you upload a material:
1. **Provide `unitId`** → Material associates with that Unit
2. Unit → links to Course via `courseId`
3. Course → linked to Category via `categoryId`

**Result:** Material is accessible through: `Category → Course → Unit → Materials`

---

## 2. LEARNING PATH & COURSE Relationship

### What is a Learning Path?
A structured sequence of courses/topics designed for a learning journey (e.g., "Pharmacy Fundamentals", "Advanced Clinical Practice")

### Hierarchy
```
CourseCategory
    ├── Course (individual course)
    │   └── Unit → Material
    │
    └── LearningPath (sequence of courses/topics)
            └── LearningPathMilestone (checkpoints)
            └── BlueprintMapping (topic weightings)
```

### Database Structure
```prisma
model LearningPath {
  id              String
  title           String           // e.g., "Pharmacy Degree Program"
  categoryId      String?          // Same category system as courses
  pathType        LearningPathType // STANDARD_STUDY | EXAM_BLUEPRINT | CLINICAL_COMPETENCY
  difficulty      CourseDifficulty
  status          CourseStatus     // draft | published | active
  pathStructure   Json?            // Stores course/topic sequence
  
  category        CourseCategory?  @relation(...)
  milestones      LearningPathMilestone[]  // Checkpoints
  blueprintMappings BlueprintMapping[]     // Topic-to-blueprint mappings
}

model BlueprintMapping {
  id              String
  learningPathId  String
  topicId         String
  weight          Float            // How important this topic is
  focusContext    FocusContext     // THEORY | APPLICATION
  
  learningPath    LearningPath     @relation(...)
  topic           Topic            @relation(...)
}

model LearningPathMilestone {
  id              String
  learningPathId  String
  title           String           // e.g., "Complete Basic Pharmacology"
  order           Int
  isOptional      Boolean
  
  learningPath    LearningPath     @relation(...)
}
```

### Key Difference
| Course | Learning Path |
|--------|---------------|
| Standalone content unit | Sequence of courses/topics |
| Has Units → Materials | Maps to Topics via BlueprintMapping |
| Directly enrollable | Can include multiple courses |
| Fixed structure | Flexible, goal-oriented path |

---

## 3. COURSE CATEGORY Hierarchy

### Structure
```prisma
model CourseCategory {
  id        String
  name      String           // e.g., "Pharmacy", "Pathology"
  slug      String           // URL-friendly: "pharmacy", "pathology"
  parentId  String?          // Self-referential: can have parent category
  
  courses       Course[]      // Courses in this category
  learningPaths LearningPath[] // Learning paths in category
  parent        CourseCategory? @relation("CategoryHierarchy", ...)
  children      CourseCategory[] @relation("CategoryHierarchy")
}
```

### Example Hierarchy
```
Healthcare (root)
├── Pharmacy (parent)
│   ├── Pharmacology
│   ├── Pharmaceutics
│   └── Clinical Pharmacy
├── Medicine
│   ├── Internal Medicine
│   └── Surgery
└── Nursing
```

---

## 4. COMPLETE RELATIONSHIP MAP

```
                           CourseCategory (hierarchical)
                                  ↑
                    ┌─────────────┴──────────────┐
                    │                            │
                  Course                   LearningPath
                 (standalone)               (pathway)
                    │                            │
         ┌──────────┼──────────┐        ┌────────┴────────┐
         │          │          │        │                 │
       Units      Materials  Quizzes   BlueprintMapping  Milestones
         │          │                   (topic weightings)
    ┌────┴────┐     │
  Topics   Materials│         
    │               │         
    └───────────────┘         
                │
              Topics ← Used by both Course Units and Learning Path


    Material Record Structure:
    ┌─────────────────────────────────┐
    │ Material                        │
    ├─────────────────────────────────┤
    │ id: uuid                        │
    │ courseId: uuid (optional)       │ ──→ Direct course link
    │ unitId: uuid (optional)         │ ──→ Specific unit in course
    │ topicId: uuid (optional)        │ ──→ Topic within unit
    │ fileId: uuid (optional)         │ ──→ File in R2 storage
    │ type: MaterialType (PDF,VIDEO)  │
    │ xapiStatements: XapiStatement[] │ ──→ Learning tracking
    │ progress: Progress[]            │ ──→ User progress
    └─────────────────────────────────┘
```

---

## 5. USER JOURNEY: How It All Connects

### Scenario 1: User Enrolls in a Course

```
User
  ├─ Enroll → Course (via CourseEnrollment)
  ├─ View → CourseCategory (context)
  ├─ Access → Units (sequential)
  │   ├─ Read → Materials (PDFs, videos)
  │   │   └─ Track → xAPI events (viewing, completion)
  │   ├─ Study → Topics
  │   └─ Complete → Quiz
  └─ Progress → stored in CourseProgress
```

### Scenario 2: User Follows a Learning Path

```
User
  ├─ Start → LearningPath (e.g., "Pharmacy Degree")
  ├─ Track → LearningPathProgress
  ├─ Achieve → LearningPathMilestone (checkpoints)
  ├─ Study → Topics via BlueprintMapping (weighted topics)
  ├─ Access → Courses linked to this path
  └─ Complete → Path → Certificate
```

---

## 6. API Usage: How to Fetch Related Data

### Get Course with All Materials
```
GET /v1/courses/:courseId
  Returns: { id, name, description, units[], materials[] }
```

### Get Materials for a Specific Unit
```
GET /v1/materials?unitId=:unitId
  Returns: Material[] filtered by unit
```

### Get Learning Path Structure
```
GET /v1/learning-paths/:pathId
  Returns: {
    title,
    category,
    pathStructure, // JSON path sequence
    blueprintMappings[], // Topic-to-path mappings
    milestones[]
  }
```

### Get Material with Download URL
```
GET /v1/materials/:id/with-url
  Returns: { id, title, type, fileUrl, xapiStatements }
```

---

## 7. How to Associate Materials with Courses

### Method 1: Via Unit (Recommended)
```
POST /v1/materials/upload
{
  "file": <binary>,
  "unitId": "unit-123",        // Material auto-links to course through unit
  "title": "Pharmacology PDF",
  "type": "PDF"
}
```
Course association: Unit → Course

### Method 2: Direct to Course
```
POST /v1/materials/upload
{
  "file": <binary>,
  "courseId": "course-456",    // Direct course link (less common)
  "title": "Course Overview",
  "type": "PDF"
}
```

### Method 3: To Topic within Unit
```
POST /v1/materials/upload
{
  "file": <binary>,
  "unitId": "unit-123",
  "topicId": "topic-789",      // Specific topic association
  "title": "Topic Deep Dive",
  "type": "PDF"
}
```

---

## 8. Key Design Patterns

### 1. **Optional Foreign Keys (Flexible Association)**
```prisma
material.courseId?   // Can be null (use unitId instead)
material.unitId?     // Preferred way to link
material.topicId?    // More specific linking
```
This allows materials to be flexible: course-level, unit-level, or topic-level.

### 2. **Category Reuse**
Both `Course` and `LearningPath` share the same `CourseCategory` model, creating a unified taxonomy.

### 3. **Full-Text Search (PostgreSQL tsvector)**
```prisma
Material.fts        // Weighted search: title(A) > description(B) > content(C)
Course.fts          // Weighted search: title > name > description > tags
```
Used for fast material/course discovery.

### 4. **xAPI Integration**
Materials track learning events:
```prisma
Material.xapiStatements[]   // xAPI learning records
Material.events[]           // Audit trail of interactions
Material.progress[]         // User progress per material
```

---

## 9. Database Indexes for Performance

| Field | Index Type | Reason |
|-------|-----------|--------|
| `Course.categoryId` | B-tree | Fast category filtering |
| `Material.courseId` | B-tree | Material by course |
| `Material.unitId` | B-tree | Material by unit |
| `Material.topicId` | B-tree | Material by topic |
| `LearningPath.categoryId` | B-tree | Path by category |
| `Material.fts` | GiN (PostgreSQL) | Full-text search |
| `Course.fts` | GiN (PostgreSQL) | Course search |

---

## 10. Summary Table

| Relationship | Source | Target | Type | Cardinality |
|-------------|--------|--------|------|-------------|
| Course → Category | Course | CourseCategory | Foreign Key | Many-to-One |
| Course → Units | Course | Unit | One-to-Many | 1:N |
| Unit → Materials | Unit | Material | One-to-Many | 1:N |
| Material → File | Material | File (R2) | One-to-One | 1:1 |
| LearningPath → Category | LearningPath | CourseCategory | Foreign Key | Many-to-One |
| LearningPath → Milestones | LearningPath | Milestone | One-to-Many | 1:N |
| Blueprint → Topic | Blueprint | Topic | Many-to-One | N:1 |
| Category → Parent | Category | Category | Self-referential | N:1 |

---

## 11. Frontend Integration Examples

### Display Course with Materials
```tsx
// In EducationalCourseLayout or CourseDetailPage
const { courseId } = useParams();

// Fetch course + units + materials
const course = await fetch(`/v1/courses/${courseId}`);
const materials = await fetch(`/v1/materials?courseId=${courseId}`);

// Display hierarchy
<CourseHeader course={course} category={course.category} />
{course.units.map(unit => (
  <UnitSection unit={unit}>
    <MaterialsList materials={materials.filter(m => m.unitId === unit.id)} />
  </UnitSection>
))}
```

### Display Learning Path
```tsx
const { pathId } = useParams();

const path = await fetch(`/v1/learning-paths/${pathId}`);
const milestones = path.milestones;
const topics = path.blueprintMappings; // Weighted topics

<LearningPathView path={path}>
  {milestones.map(milestone => (
    <Milestone key={milestone.id} milestone={milestone} />
  ))}
</LearningPathView>
```

### Embed Materials in Course Layout
```tsx
// Using MaterialsPanel component (created earlier)
<MaterialsPanel 
  courseId={courseId}
  materials={courseMaterials}  // Filter by courseId
/>
```

