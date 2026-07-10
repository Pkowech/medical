import React, { useState } from 'react';
import { Course } from '@/shared/types/courseInterface';
import { Unit } from '../services/unitService';
import { Topic } from '../services/topicService';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ChevronDown, ChevronRight, Trash2, Edit, Plus } from 'lucide-react';

interface AdminCourseListProps {
  courses: Course[];
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
  onAddUnit: (course: Course) => void;
  onEditUnit: (unit: Unit, courseId: string) => void;
  onDeleteUnit: (unit: Unit) => void;
  onAddTopic: (unit: Unit, courseId: string) => void;
  onEditTopic: (topic: Topic, unitId: string) => void;
  onDeleteTopic: (topic: Topic) => void;
}

export const AdminCourseList: React.FC<AdminCourseListProps> = ({
  courses,
  onEdit,
  onDelete,
  onAddUnit,
  onEditUnit,
  onDeleteUnit,
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Map<string, boolean>>(new Map());

  const toggleCourseExpanded = (courseId: string) => {
    const newSet = new Set(expanded);
    if (newSet.has(courseId)) {
      newSet.delete(courseId);
    } else {
      newSet.add(courseId);
    }
    setExpanded(newSet);
  };

  const toggleUnitExpanded = (unitId: string) => {
    const newMap = new Map(expandedUnits);
    newMap.set(unitId, !newMap.get(unitId));
    setExpandedUnits(newMap);
  };

  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-500">No courses yet. Create your first course to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {courses.map((course) => (
        <Card key={course.id} className="overflow-hidden">
          <CardContent className="pt-6">
            {/* Course Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <button
                  onClick={() => toggleCourseExpanded(course.id)}
                  className="p-0 hover:bg-gray-100 rounded transition"
                >
                  {expanded.has(course.id) ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </button>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{course.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-1">{course.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">{course.status || 'draft'}</Badge>
                    {course.difficulty && <Badge variant="outline">{course.difficulty}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(course)}
                  className="gap-1"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(course)}
                  className="gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Course Details - Expanded */}
            {expanded.has(course.id) && (
              <div className="mt-6 pl-12 border-l-2 border-gray-200 space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold">Units ({course.units?.length || 0})</h4>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onAddUnit(course)}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Unit
                  </Button>
                </div>

                {course.units && course.units.length > 0 ? (
                  <div className="space-y-3">
                    {course.units.map((unit: Unit) => (
                      <div key={unit.id} className="border rounded-lg p-4 bg-gray-50">
                        {/* Unit Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={() => toggleUnitExpanded(unit.id)}
                              className="p-0 hover:bg-gray-200 rounded transition"
                            >
                              {expandedUnits.get(unit.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div className="flex-1">
                              <p className="font-medium">{unit.title}</p>
                              <p className="text-xs text-gray-500">{unit.description}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEditUnit(unit, course.id)}
                              className="gap-1"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onDeleteUnit(unit)}
                              className="gap-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Topics - Expanded Unit */}
                        {expandedUnits.get(unit.id) && (
                          <div className="mt-4 pl-8 border-l-2 border-gray-300 space-y-3">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm font-semibold">Topics ({unit.topics?.length || 0})</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAddTopic(unit, course.id)}
                                className="gap-1 text-xs"
                              >
                                <Plus className="h-3 w-3" />
                                Add Topic
                              </Button>
                            </div>

                            {unit.topics && unit.topics.length > 0 ? (
                              <div className="space-y-2">
                                {unit.topics.map((topic: Topic) => (
                                  <div
                                    key={topic.id}
                                    className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                                  >
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{topic.title}</p>
                                      <div className="flex gap-1 mt-1">
                                        {topic.isMandatory && (
                                          <Badge variant="default" className="text-xs">
                                            Mandatory
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onEditTopic(topic, unit.id)}
                                        className="gap-1"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => onDeleteTopic(topic)}
                                        className="gap-1"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 italic">No topics yet</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No units yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
