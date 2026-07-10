'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import {
  GitBranch,
  Lightbulb,
  Target,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  XCircle,
} from 'lucide-react';

interface DecisionNode {
  id: string;
  type: 'decision' | 'outcome' | 'consequence';
  title: string;
  content: string;
  options?: {
    id: string;
    text: string;
    leads_to: string;
    is_optimal: boolean;
    points: number;
    immediate_feedback?: string;
    consequences?: string[];
  }[];
  outcomes?: {
    type: 'success' | 'warning' | 'error';
    message: string;
    learning_points: string[];
    next_actions?: string[];
  }[];
  position: { x: number; y: number };
  unlocked: boolean;
  visited: boolean;
}

interface DecisionPath {
  nodes: string[];
  decisions: {
    node_id: string;
    option_id: string;
    timestamp: Date;
    points_earned: number;
  }[];
  total_points: number;
  efficiency_score: number;
  clinical_reasoning_score: number;
}

interface DecisionTreeLogicProps {
  caseId: string;
  _caseId?: string;
  attemptId: string;
  decisionTree: {
    nodes: DecisionNode[];
    starting_node: string;
    optimal_paths: string[][];
    learning_objectives: string[];
  };
  onPathComplete?: (path: DecisionPath) => void;
  onDecisionMade?: (nodeId: string, optionId: string) => void;
}

export function DecisionTreeLogic({
  _caseId,
  attemptId,
  decisionTree,
  onPathComplete,
  onDecisionMade,
}: DecisionTreeLogicProps) {
  const [currentNode, setCurrentNode] = useState<string>(decisionTree.starting_node);
  const [decisionPath, setDecisionPath] = useState<DecisionPath>({
    nodes: [decisionTree.starting_node],
    decisions: [],
    total_points: 0,
    efficiency_score: 100,
    clinical_reasoning_score: 0,
  });
  const [showConsequences, setShowConsequences] = useState<Record<string, boolean>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  // Track visited nodes to avoid revisiting and for analytics
  const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set([decisionTree.starting_node]));

  const currentNodeData = decisionTree.nodes.find(node => node.id === currentNode);

  const makeDecision = async (optionId: string) => {
    if (!currentNodeData) return;

    const selectedOption = currentNodeData.options?.find(opt => opt.id === optionId);
    if (!selectedOption) return;

    // Record the decision
    const decision = {
      node_id: currentNode,
      option_id: optionId,
      timestamp: new Date(),
      points_earned: selectedOption.points,
    };

    // Update decision path
    const newPath = {
      ...decisionPath,
      decisions: [...decisionPath.decisions, decision],
      total_points: decisionPath.total_points + selectedOption.points,
      nodes: [...decisionPath.nodes, selectedOption.leads_to],
    };

    // Calculate efficiency score (decreases with suboptimal choices)
    if (!selectedOption.is_optimal) {
      newPath.efficiency_score = Math.max(0, newPath.efficiency_score - 10);
    }

    // Calculate clinical reasoning score
    newPath.clinical_reasoning_score = calculateClinicalReasoningScore(newPath);

    setDecisionPath(newPath);
    setSelectedOptions(prev => ({ ...prev, [currentNode]: optionId }));

    // Show immediate feedback if available
    if (selectedOption.immediate_feedback) {
      setShowConsequences(prev => ({ ...prev, [currentNode]: true }));
    }

    // Move to next node after a brief delay
    setTimeout(
      () => {
        setCurrentNode(selectedOption.leads_to);
        setVisitedNodes((prev: Set<string>) => new Set([...prev, selectedOption.leads_to]));

        // Check if path is complete
        const nextNode = decisionTree.nodes.find(node => node.id === selectedOption.leads_to);
        if (nextNode?.type === 'outcome') {
          onPathComplete?.(newPath);
        }
      },
      selectedOption.immediate_feedback ? 2000 : 500
    );

    // Notify parent component
    onDecisionMade?.(currentNode, optionId);

    // Save decision to backend
    await saveDecision(decision);
  };

  const saveDecision = async (decision: unknown) => {
    try {
      await fetch(`/api/clinical-cases/attempts/${attemptId}/decisions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(decision),
      });
    } catch (error) {
      console.error('Failed to save decision:', error);
    }
  };

  const calculateClinicalReasoningScore = (path: DecisionPath): number => {
    const totalDecisions = path.decisions.length;
    if (totalDecisions === 0) return 0;

    const optimalDecisions = path.decisions.filter(decision => {
      const node = decisionTree.nodes.find(n => n.id === decision.node_id);
      const option = node?.options?.find(opt => opt.id === decision.option_id);
      return option?.is_optimal;
    }).length;

    return Math.round((optimalDecisions / totalDecisions) * 100);
  };

  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case 'decision':
        return <GitBranch className="h-5 w-5 text-blue-500" />;
      case 'outcome':
        return <Target className="h-5 w-5 text-green-500" />;
      case 'consequence':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <GitBranch className="h-5 w-5 text-gray-500" />;
    }
  };

  const getOutcomeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50';
      case 'error':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const isOptimalPath = () => {
    return decisionTree.optimal_paths.some(optimalPath =>
      optimalPath.every(nodeId => decisionPath.nodes.includes(nodeId))
    );
  };

  if (!currentNodeData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-medium mb-2">Decision Tree Error</h3>
          <p className="text-gray-600">Unable to load the current decision point.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-blue-500" />
              Clinical Decision Tree
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{decisionPath.total_points}</div>
                <p className="text-xs text-gray-600">Points</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {decisionPath.efficiency_score}%
                </div>
                <p className="text-xs text-gray-600">Efficiency</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {decisionPath.clinical_reasoning_score}%
                </div>
                <p className="text-xs text-gray-600">Reasoning</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Current Decision Node */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getNodeTypeIcon(currentNodeData.type)}
            {currentNodeData.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose max-w-none">
            <p>{currentNodeData.content}</p>
          </div>

          {/* Decision Options */}
          {currentNodeData.type === 'decision' && currentNodeData.options && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                What is your next action?
              </h4>
              {currentNodeData.options.map(option => {
                const isSelected = selectedOptions[currentNode] === option.id;
                const showingConsequences = showConsequences[currentNode];

                return (
                  <div key={option.id} className="space-y-2">
                    <button
                      onClick={() => makeDecision(option.id)}
                      disabled={showingConsequences}
                      className={`w-full text-left p-4 border rounded-lg transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      } ${showingConsequences ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="flex-1">{option.text}</span>
                        <div className="flex items-center gap-2 ml-4">
                          {option.is_optimal && (
                            <Badge className="bg-green-100 text-green-800">Optimal</Badge>
                          )}
                          <Badge variant="outline">+{option.points} pts</Badge>
                        </div>
                      </div>
                    </button>

                    {/* Immediate Feedback */}
                    {isSelected && showingConsequences && option.immediate_feedback && (
                      <Card
                        className={`border-l-4 ${
                          option.is_optimal
                            ? 'border-l-green-500 bg-green-50'
                            : 'border-l-yellow-500 bg-yellow-50'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-2">
                            {option.is_optimal ? (
                              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className="text-sm font-medium mb-1">
                                {option.is_optimal ? 'Excellent Choice!' : 'Consider This...'}
                              </p>
                              <p className="text-sm">{option.immediate_feedback}</p>
                              {option.consequences && option.consequences.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium mb-1">Consequences:</p>
                                  <ul className="text-xs space-y-1">
                                    {option.consequences.map((consequence, index) => (
                                      <li key={index} className="flex items-start gap-1">
                                        <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                        <span>{consequence}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Outcome Display */}
          {currentNodeData.type === 'outcome' && currentNodeData.outcomes && (
            <div className="space-y-4">
              {currentNodeData.outcomes.map((outcome, index) => (
                <Card key={index} className={`border-l-4 ${getOutcomeColor(outcome.type)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      {outcome.type === 'success' && (
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      )}
                      {outcome.type === 'warning' && (
                        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      )}
                      {outcome.type === 'error' && (
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium mb-2">{outcome.message}</p>

                        {outcome.learning_points.length > 0 && (
                          <div className="mb-3">
                            <h5 className="text-sm font-medium mb-1">Key Learning Points:</h5>
                            <ul className="text-sm space-y-1">
                              {outcome.learning_points.map((point, pointIndex) => (
                                <li key={pointIndex} className="flex items-start gap-1">
                                  <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-500" />
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {outcome.next_actions && outcome.next_actions.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-1">Recommended Next Actions:</h5>
                            <ul className="text-sm space-y-1">
                              {outcome.next_actions.map((action, actionIndex) => (
                                <li key={actionIndex} className="flex items-start gap-1">
                                  <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>{action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Final Score Summary */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="h-5 w-5 text-blue-500" />
                    <h4 className="font-medium text-blue-900">Decision Path Summary</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {decisionPath.total_points}
                      </div>
                      <p className="text-xs text-blue-700">Total Points</p>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        {decisionPath.efficiency_score}%
                      </div>
                      <p className="text-xs text-green-700">Efficiency</p>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600">
                        {decisionPath.clinical_reasoning_score}%
                      </div>
                      <p className="text-xs text-purple-700">Clinical Reasoning</p>
                    </div>
                  </div>
                  {isOptimalPath() && (
                    <div className="mt-3 p-2 bg-green-100 rounded text-center">
                      <p className="text-sm font-medium text-green-800">
                        🎉 Congratulations! You followed an optimal clinical pathway.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Path Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            Your Decision Path
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {decisionPath.nodes.map((nodeId, index) => {
              const node = decisionTree.nodes.find(n => n.id === nodeId);
              const isCurrentNode = nodeId === currentNode;

              return (
                <div key={nodeId} className="flex items-center gap-2">
                  <Badge
                    variant={isCurrentNode ? 'default' : 'outline'}
                    className={isCurrentNode ? 'bg-blue-500' : ''}
                  >
                    {node?.title || `Node ${index + 1}`}
                  </Badge>
                  {index < decisionPath.nodes.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
