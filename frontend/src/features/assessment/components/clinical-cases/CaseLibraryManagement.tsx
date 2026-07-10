'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Copy,
  Eye,
  Users,
  Clock,
  Target,
  BookOpen,
  BarChart3,
  Download,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

interface ClinicalCase {
  id: string;
  title: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  specialty: string;
  status: 'draft' | 'published' | 'archived';
  estimated_duration_minutes: number;
  learning_objectives: string[];
  tags: string[];
  created_at: Date;
  updated_at: Date;
  created_by: string;
  creator_name: string;
  attempts_count: number;
  average_score: number;
  average_completion_time: number;
}

interface CaseFilters {
  search: string;
  specialty: string;
  complexity: string;
  status: string;
  created_by: string;
}

interface CaseLibraryManagementProps {
  userRole: 'teacher' | 'admin';
  courseId?: string;
  unitId?: string;
}

export function CaseLibraryManagement({ userRole: _userRole, courseId, unitId }: CaseLibraryManagementProps) {
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<ClinicalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [_showCreateModal, setShowCreateModal] = useState(false);
  const [_selectedCase, setSelectedCase] = useState<ClinicalCase | null>(null);
  const [filters, setFilters] = useState<CaseFilters>({
    search: '',
    specialty: '',
    complexity: '',
    status: '',
    created_by: '',
  });

  const specialties = [
    'Internal Medicine',
    'Cardiology',
    'Neurology',
    'Pediatrics',
    'Surgery',
    'Emergency',
    'Psychiatry',
    'Obstetrics',
    'Dermatology',
    'Radiology',
  ];

  const complexities = ['simple', 'moderate', 'complex', 'expert'];
  const statuses = ['draft', 'published', 'archived'];

  useEffect(() => {
    loadCases();
  }, [courseId, unitId]);

  useEffect(() => {
    applyFilters();
  }, [cases, filters]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (courseId) params.append('course_id', courseId);
      if (unitId) params.append('unit_id', unitId);

      const response = await fetch(`/api/clinical-cases?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const casesData = await response.json();
        setCases(casesData);
      } else {
        toast.error('Failed to load clinical cases');
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
      toast.error('Failed to load clinical cases');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...cases];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        case_ =>
          case_.title.toLowerCase().includes(searchLower) ||
          case_.description.toLowerCase().includes(searchLower) ||
          case_.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    if (filters.specialty) {
      filtered = filtered.filter(case_ => case_.specialty === filters.specialty);
    }

    if (filters.complexity) {
      filtered = filtered.filter(case_ => case_.complexity === filters.complexity);
    }

    if (filters.status) {
      filtered = filtered.filter(case_ => case_.status === filters.status);
    }

    if (filters.created_by) {
      filtered = filtered.filter(case_ => case_.created_by === filters.created_by);
    }

    setFilteredCases(filtered);
  };

  const handleFilterChange = (key: keyof CaseFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      specialty: '',
      complexity: '',
      status: '',
      created_by: '',
    });
  };

  const duplicateCase = async (caseId: string) => {
    try {
      const response = await fetch(`/api/clinical-cases/${caseId}/duplicate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        toast.success('Case duplicated successfully');
        loadCases();
      } else {
        toast.error('Failed to duplicate case');
      }
    } catch (error) {
      console.error('Failed to duplicate case:', error);
      toast.error('Failed to duplicate case');
    }
  };

  const deleteCase = async (caseId: string) => {
    if (!confirm('Are you sure you want to delete this case? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/clinical-cases/${caseId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        toast.success('Case deleted successfully');
        loadCases();
      } else {
        toast.error('Failed to delete case');
      }
    } catch (error) {
      console.error('Failed to delete case:', error);
      toast.error('Failed to delete case');
    }
  };

  const updateCaseStatus = async (caseId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/clinical-cases/${caseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success(`Case ${newStatus} successfully`);
        loadCases();
      } else {
        toast.error(`Failed to ${newStatus} case`);
      }
    } catch (error) {
      console.error(`Failed to ${newStatus} case:`, error);
      toast.error(`Failed to ${newStatus} case`);
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple':
        return 'bg-green-100 text-green-800';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'complex':
        return 'bg-orange-100 text-orange-800';
      case 'expert':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clinical Case Library</h2>
          <p className="text-gray-600">Manage and organize your clinical case studies</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Case
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search cases..."
                value={filters.search}
                onChange={e => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.specialty}
              onValueChange={value => handleFilterChange('specialty', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Specialties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Specialties</SelectItem>
                {specialties.map(specialty => (
                  <SelectItem key={specialty} value={specialty}>
                    {specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.complexity}
              onValueChange={value => handleFilterChange('complexity', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Complexities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Complexities</SelectItem>
                {complexities.map(complexity => (
                  <SelectItem key={complexity} value={complexity}>
                    {complexity.charAt(0).toUpperCase() + complexity.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={value => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cases Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCases.map(case_ => (
          <Card key={case_.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-2 mb-2">{case_.title}</CardTitle>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getComplexityColor(case_.complexity)}>
                      {case_.complexity}
                    </Badge>
                    <Badge className={getStatusColor(case_.status)}>{case_.status}</Badge>
                    <Badge variant="outline">{case_.specialty}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCase(case_)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => duplicateCase(case_.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteCase(case_.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">{case_.description}</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{case_.estimated_duration_minutes} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span>{case_.attempts_count} attempts</span>
                  </div>
                </div>

                {case_.attempts_count > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4 text-gray-400" />
                      <span>Avg Score: {case_.average_score.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-4 w-4 text-gray-400" />
                      <span>Avg Time: {Math.round(case_.average_completion_time / 60)}m</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {case_.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {case_.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{case_.tags.length - 3} more
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-gray-500">By {case_.creator_name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(case_.updated_at).toLocaleDateString()}
                  </span>
                </div>

                {case_.status === 'draft' && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => updateCaseStatus(case_.id, 'published')}
                  >
                    Publish Case
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCases.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No Cases Found</h3>
            <p className="text-gray-600 mb-4">
              {cases.length === 0
                ? 'Create your first clinical case to get started.'
                : 'Try adjusting your filters to find more cases.'}
            </p>
            {cases.length === 0 && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Case
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
