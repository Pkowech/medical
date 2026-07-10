// frontend/src/components/settings/IntegrationConfigForm.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Integration } from '@/shared/types/systemInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';

interface IntegrationConfigFormProps {
  integration: Integration;
  onSave: (id: string, config: Record<string, unknown>) => void;
  onCancel: () => void;
}

export const IntegrationConfigForm: React.FC<IntegrationConfigFormProps> = ({
  integration,
  onSave,
  onCancel,
}) => {
  const [configData, setConfigData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setConfigData(((integration as { currentConfig?: Record<string, unknown> }) || {}).currentConfig || {});
  }, [integration]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target;
    setConfigData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(integration.id, configData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure {integration.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(integration.configFields || []).map(
            (field: { key: string; label: string; type: string }) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.type === 'checkbox' ? (
                  <Checkbox
                    id={field.key}
                    checked={(configData[field.key] as boolean) ?? false}
                    onCheckedChange={(checked: boolean) =>
                      setConfigData(prev => ({ ...prev, [field.key]: checked }))
                    }
                  />
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    value={(configData[field.key] as string) ?? ''}
                    onChange={handleChange}
                  />
                )}
              </div>
            )
          )}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Save Configuration</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
