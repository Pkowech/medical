'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Brain,
  Clock,
  Target,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
  Sparkles,
  BookOpen,
  ArrowRight,
  RotateCcw,
  GraduationCap,
  Award,
  Layers,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useAssessments } from '@/features/assessment/hooks/useAssessments';
import { AdaptiveQuiz } from '@/features/assessment/components/adaptiveQuiz/AdaptiveQuiz';
import { PerformanceAnalyticsContent } from '@/features/assessment/components/PerformanceAnalytics';
import type { Assessment } from '@/features/assessment/services/assessmentService';

export function AssessmentDashboard() {
  const { data: session } = useSession();
  const {
    assessments,
    summary,
    history,
    historyError,
    loading,
    refreshAssessments,
  } = useAssessments();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [isAdaptiveActive, setIsAdaptiveActive] = useState(false);

  const categories = ['All', ...new Set(assessments.map(assessment => assessment.category))];

  const filteredAssessments = assessments.filter(assessment => {
    const matchesCategory = selectedCategory === 'All' || assessment.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesType = selectedType === 'All' || assessment.type.toLowerCase() === selectedType.toLowerCase();
    const matchesSearch =
      assessment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assessment.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assessment.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesType && matchesSearch;
  });

  const getTypeBadge = (type: Assessment['type']) => {
    switch (type) {
      case 'adaptive':
        return <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">AI Adaptive</Badge>;
      default:
        return <Badge variant="secondary">Modular Quiz</Badge>;
    }
  };

  const overallScore = summary?.overallScore ?? null;
  const questionsAttempted = summary?.questionsAttempted ?? (summary?.categoryBreakdown?.reduce((acc, c) => acc + (c.questionsAnswered || 0), 0) || 0);
  const totalAttempts = summary?.totalAttempts ?? 0;

  if (isAdaptiveActive) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setIsAdaptiveActive(false)} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Back to Assessment Hub
          </Button>
          <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center gap-1.5 py-1 px-3">
            <Sparkles className="h-3.5 w-3.5" />
            Adaptive Diagnostic Session
          </Badge>
        </div>
        <AdaptiveQuiz onComplete={() => { void refreshAssessments(); }} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Top Academic Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Academic Score</CardTitle>
            <Award className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? '…' : overallScore !== null && Number.isFinite(overallScore) ? `${overallScore.toFixed(1)}%` : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Weighted average across completed tests</p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed Attempts</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{loading ? '…' : summary ? totalAttempts : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">Evaluations submitted to date</p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Questions Answered</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{loading ? '…' : summary ? questionsAttempted : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">Clinical question items resolved</p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clinical Readiness</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">—</div>
            <p className="text-xs text-muted-foreground mt-1">No readiness assessment available</p>
          </CardContent>
        </Card>
      </div>

      {/* Featured Adaptive Assessment Callout */}
      <Card className="border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-white font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Computerized Adaptive Testing (CAT)
                </Badge>
                <span className="text-xs text-muted-foreground">Item Response Theory Enabled</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">AI-Powered Diagnostic Knowledge Evaluation</h2>
              <p className="text-sm text-muted-foreground">
                Calibrates clinical item difficulty dynamically based on your accuracy and response confidence. Pinpoint prerequisite knowledge gaps before high-stakes exams.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button onClick={() => setIsAdaptiveActive(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm">
                <Brain className="h-4 w-4" />
                Start Adaptive Diagnostic
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="assessments" className="space-y-6">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="assessments" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Curriculum Assessments
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Academic Analytics & Weak Areas
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            History & Retakes
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Available Assessments */}
        <TabsContent value="assessments" className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search assessments, topics, specialties..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mr-1">
                <Layers className="h-3.5 w-3.5" /> Category:
              </span>
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="text-xs h-8"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Assessment Cards Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
            </div>
          ) : filteredAssessments.length === 0 ? (
            <Card className="text-center p-12">
              <CardContent className="space-y-4">
                <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-semibold text-foreground">No assessments found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  No medical assessments match your current search and category filters. Try resetting the filters.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setSelectedType('All');
                  }}
                >
                  Reset Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssessments.map(assessment => (
                <Card
                  key={assessment.id}
                  className="flex flex-col justify-between hover:shadow-md transition-shadow border-border dark:border-border/60"
                >
                  <CardHeader className="space-y-3 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      {getTypeBadge(assessment.type)}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        {assessment.category}
                      </span>
                      <CardTitle className="text-lg font-bold text-foreground mt-1 line-clamp-2">
                        {assessment.title}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs line-clamp-3">
                      {assessment.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/40 dark:bg-muted/20 p-2.5 rounded-md">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{assessment.questionCount} Questions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : 'Untimed'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{assessment.passingScore > 0 ? `Pass: ${assessment.passingScore}%` : 'Pass score n/a'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Accredited</span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                    {assessment.type === 'adaptive' ? (
                      <Button
                        onClick={() => setIsAdaptiveActive(true)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        Start Adaptive Session
                      </Button>
                    ) : (
                      <Button
                        asChild
                        className="w-full gap-2"
                      >
                        <Link href={`/assessment/${assessment.id}`}>
                          <span>Start Assessment</span>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Academic Analytics */}
        <TabsContent value="analytics" className="space-y-6">
          {summary ? (
            <PerformanceAnalyticsContent userId={session?.user?.id || ''} data={summary} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Assessment analytics will appear here after your first completed assessment.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: History & Retakes */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Assessment Attempts</CardTitle>
                <CardDescription>Review score reports, question breakdowns, and retake assessments.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/quiz/history">
                  Detailed Quiz Log <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {historyError ? (
                <p className="py-4 text-sm text-muted-foreground" role="status">
                  Assessment history couldn’t be loaded. Try refreshing the page.
                </p>
              ) : history.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No completed assessment attempts yet.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {history.map(item => (
                    <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{item.quizTitle}</span>
                        <Badge variant="secondary" className="text-xs">Quiz</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.completedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          {Number.isFinite(item.score) ? `${item.score.toFixed(1)}%` : '—'}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {item.correctAnswers}/{item.totalQuestions} correct
                        </span>
                      </div>

                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/assessment/${item.quizId}`}>
                          Review
                        </Link>
                      </Button>
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
