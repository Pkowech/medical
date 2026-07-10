/*
// frontend/src/components/settings/IntegrationList.tsx

'use client';

import React from 'react';
import { Integration } from '@/shared/types/systemInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Settings, Plug, PlugZap } from 'lucide-react';

interface IntegrationListProps {
  integrations: Integration[];
  onUpdateStatus: (id: string, status: 'connected' | 'disconnected' | 'pending') => void;
  onEditConfig: (integration: Integration) => void;
}

export const IntegrationList: React.FC<IntegrationListProps> = ({
  integrations,
  onUpdateStatus,
  onEditConfig,
}) => {
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'connected':
        return 'default';
      case 'disconnected':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <PlugZap className="h-4 w-4 text-green-500 mr-1" />;
      case 'disconnected':
        return <Plug className="h-4 w-4 text-red-500 mr-1" />;
      case 'pending':
        return <Plug className="h-4 w-4 text-yellow-500 mr-1" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Integrations</CardTitle>
      </CardHeader>
      <CardContent>
        {integrations.length === 0 ? (
          <p className="text-muted-foreground text-center">No integrations found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map(integration => (
              <div key={integration.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{integration.name}</h3>
                  <Badge variant={getStatusBadgeVariant(integration.status)} className="flex items-center">
                    {getStatusIcon(integration.status)}
                    {integration.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground flex-1">{integration.description}</p>
                <div className="flex justify-end space-x-2">
                  {integration.configFields.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => onEditConfig(integration)}>
                      <Settings className="h-4 w-4 mr-2" /> Configure
                    </Button>
                  )}
                  {integration.status === 'disconnected' ? (
                    <Button size="sm" onClick={() => onUpdateStatus(integration.id, 'connected')}>
                      Connect
                    </Button>
                  ) : integration.status === 'connected' ? (
                    <Button variant="destructive" size="sm" onClick={() => onUpdateStatus(integration.id, 'disconnected')}>
                      Disconnect
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

*/
