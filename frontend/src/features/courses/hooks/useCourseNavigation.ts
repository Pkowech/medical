import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

type NavLesson = { id: string | number };
type NavChapter = { id: string | number; lessons: NavLesson[] };

export const useCourseNavigation = (chapters: NavChapter[] = []) => {
  const params = useParams();
  const router = useRouter();

  const courseId = params?.courseId as string;
  const slug = params?.slug as string[] | undefined;

  let unitIdFromUrl: string | undefined;
  let topicIdFromUrl: string | undefined;

  if (slug && slug[0] === 'units' && slug[1]) {
    unitIdFromUrl = slug[1];
    if (slug[2] === 'topics' && slug[3]) {
      topicIdFromUrl = slug[3];
    }
  }

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);

  // Sync state from URL
  useEffect(() => {
    if (!chapters.length) return;
    
    let chIdx = 0;
    let lsIdx = 0;
    
    if (unitIdFromUrl) {
      chIdx = chapters.findIndex(c => String(c.id) === String(unitIdFromUrl));
      if (chIdx === -1) chIdx = 0;
      
      if (topicIdFromUrl && chapters[chIdx]?.lessons) {
        lsIdx = chapters[chIdx].lessons.findIndex(l => String(l.id) === String(topicIdFromUrl));
        if (lsIdx === -1) lsIdx = 0;
      }
    }
    
    setCurrentChapterIndex(chIdx);
    setCurrentLessonIndex(lsIdx);
  }, [chapters, unitIdFromUrl, topicIdFromUrl]);

  const currentChapter = chapters?.[currentChapterIndex];
  const currentLesson = currentChapter?.lessons?.[currentLessonIndex];
  const lessonKey = `${currentChapter?.id ?? '0'}-${currentLesson?.id ?? '0'}`;

  const navigateTo = (chapterIndex: number, lessonIndex: number) => {
    const targetChapter = chapters?.[chapterIndex];
    const targetLesson = targetChapter?.lessons?.[lessonIndex];
    
    if (targetChapter && courseId) {
      if (targetLesson) {
        router.push(`/courses/${courseId}/units/${targetChapter.id}/topics/${targetLesson.id}`);
      } else {
        router.push(`/courses/${courseId}/units/${targetChapter.id}`);
      }
    }
  };

  const navigateNext = () => {
    if (currentLessonIndex < (currentChapter?.lessons?.length || 0) - 1) {
      navigateTo(currentChapterIndex, currentLessonIndex + 1);
    } else if (currentChapterIndex < chapters.length - 1) {
      navigateTo(currentChapterIndex + 1, 0);
    }
  };

  const navigatePrev = () => {
    if (currentLessonIndex > 0) {
      navigateTo(currentChapterIndex, currentLessonIndex - 1);
    } else if (currentChapterIndex > 0) {
      const prevChapter = chapters[currentChapterIndex - 1];
      navigateTo(currentChapterIndex - 1, (prevChapter.lessons?.length || 1) - 1);
    }
  };

  const isFirstLesson = currentChapterIndex === 0 && currentLessonIndex === 0;
  const isLastLesson =
    currentChapterIndex === chapters.length - 1 &&
    currentLessonIndex === (currentChapter?.lessons?.length || 1) - 1;

  return {
    currentChapter,
    currentLesson,
    currentChapterIndex,
    currentLessonIndex,
    lessonKey,
    navigateTo,
    navigateNext,
    navigatePrev,
    isFirstLesson,
    isLastLesson,
  };
};
