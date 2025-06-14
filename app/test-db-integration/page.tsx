'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/store/chat.store.db'; // Using DB-enabled version
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/utils/logger';
import { ChartPersistenceManagerDB } from '@/lib/storage/chart-persistence-db';
import { ChartDrawing } from '@/lib/validation/chart-drawing.schema';
import { useAnalysisHistory } from '@/store/analysis-history.store.db';
import { DbStats } from '@/types/database.types';

export default function TestDbIntegration() {
  const chat = useChat();
  const analysis = useAnalysisHistory();
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chartDbEnabled, setChartDbEnabled] = useState(false);
  const [localDrawings, setLocalDrawings] = useState<ChartDrawing[]>([]);

  // Load database stats
  const loadDbStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test/db-stats');
      const stats = await response.json();
      setDbStats(stats);
    } catch (error) {
      logger.error('Failed to load DB stats', { error });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadDbStats();
    loadLocalDrawings();
    setChartDbEnabled(ChartPersistenceManagerDB.isDatabaseEnabled());
  }, []);

  const loadLocalDrawings = () => {
    try {
      const stored = localStorage.getItem('cryptrade_chart_drawings');
      if (stored) {
        const drawings = JSON.parse(stored);
        setLocalDrawings(Array.isArray(drawings) ? drawings : []);
      }
    } catch (error) {
      logger.error('Failed to load local drawings', { error });
    }
  };

  const handleEnableDb = async () => {
    await chat.enableDbSync();
    await loadDbStats();
  };

  const handleDisableDb = () => {
    chat.disableDbSync();
  };

  const handleSyncToDb = async () => {
    await chat.syncWithDatabase();
    await loadDbStats();
  };

  const handleLoadFromDb = async () => {
    await chat.loadFromDatabase();
  };

  const handleCreateTestSession = async () => {
    const sessionId = await chat.createSession();
    await chat.addMessage(sessionId, {
      role: 'user',
      content: 'This is a test message from DB integration demo',
    });
    await chat.addMessage(sessionId, {
      role: 'assistant',
      content: 'This is an AI response stored in the database!',
      type: 'text',
    });
    await loadDbStats();
  };

  const handleClearLocalStorage = () => {
    localStorage.removeItem('chat-storage');
    chat.reset();
    window.location.reload();
  };

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Database Integration Test</h1>

      {/* Status Section */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">DB Sync</p>
            <Badge variant={chat.isDbEnabled ? 'default' : 'secondary'}>
              {chat.isDbEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sync Status</p>
            <Badge variant={chat.isSyncing ? 'default' : 'outline'}>
              {chat.isSyncing ? 'Syncing...' : 'Idle'}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Local Sessions</p>
            <p className="text-2xl font-bold">{Object.keys(chat.sessions).length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Local Messages</p>
            <p className="text-2xl font-bold">
              {Object.values(chat.messagesBySession).reduce((acc, msgs) => acc + msgs.length, 0)}
            </p>
          </div>
        </div>
      </Card>

      {/* Database Stats */}
      {dbStats && (
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Database Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">DB Sessions</p>
              <p className="text-2xl font-bold">{dbStats.sessions}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">DB Messages</p>
              <p className="text-2xl font-bold">{dbStats.messages}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">DB Users</p>
              <p className="text-2xl font-bold">{dbStats.users}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">DB Drawings</p>
              <p className="text-2xl font-bold">{dbStats.drawings}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">DB Analyses</p>
              <p className="text-2xl font-bold">{dbStats.analyses}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <Tabs defaultValue="sync" className="mb-8">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sync">Sync Controls</TabsTrigger>
          <TabsTrigger value="test">Test Data</TabsTrigger>
          <TabsTrigger value="chart">Chart Data</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sync" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={handleEnableDb} 
              disabled={chat.isDbEnabled}
              variant="default"
            >
              Enable DB Sync
            </Button>
            <Button 
              onClick={handleDisableDb} 
              disabled={!chat.isDbEnabled}
              variant="outline"
            >
              Disable DB Sync
            </Button>
            <Button 
              onClick={handleSyncToDb} 
              disabled={!chat.isDbEnabled || chat.isSyncing}
              variant="secondary"
            >
              Sync to Database
            </Button>
            <Button 
              onClick={handleLoadFromDb} 
              disabled={!chat.isDbEnabled || chat.isLoading}
              variant="secondary"
            >
              Load from Database
            </Button>
            <Button 
              onClick={loadDbStats} 
              disabled={isLoading}
              variant="outline"
            >
              Refresh Stats
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="test" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button onClick={handleCreateTestSession}>
              Create Test Session
            </Button>
            <Button 
              onClick={() => {
                const sessionId = chat.currentSessionId || '';
                if (sessionId) {
                  chat.addMessage(sessionId, {
                    role: 'user',
                    content: `Test message at ${new Date().toLocaleTimeString()}`,
                  });
                }
              }}
              disabled={!chat.currentSessionId}
              variant="outline"
            >
              Add Test Message
            </Button>
            <Button 
              onClick={() => {
                const sessionId = chat.currentSessionId || '';
                if (sessionId) {
                  chat.renameSession(sessionId, `Renamed at ${new Date().toLocaleTimeString()}`);
                }
              }}
              disabled={!chat.currentSessionId}
              variant="outline"
            >
              Rename Current Session
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="chart" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Chart Drawing Persistence</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">DB Enabled</p>
                <Badge variant={chartDbEnabled ? 'default' : 'secondary'}>
                  {chartDbEnabled ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Local Drawings</p>
                <p className="text-2xl font-bold">{localDrawings.length}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  await ChartPersistenceManagerDB.enableDatabase(chat.currentSessionId || undefined);
                  setChartDbEnabled(true);
                  await loadDbStats();
                }}
                disabled={chartDbEnabled}
                size="sm"
              >
                Enable Chart DB
              </Button>
              <Button
                onClick={() => {
                  ChartPersistenceManagerDB.disableDatabase();
                  setChartDbEnabled(false);
                }}
                disabled={!chartDbEnabled}
                size="sm"
                variant="outline"
              >
                Disable Chart DB
              </Button>
              <Button
                onClick={async () => {
                  // Create a test drawing
                  const testDrawing: ChartDrawing = {
                    id: `test-${Date.now()}`,
                    type: 'trendline',
                    points: [
                      { time: Date.now() - 3600000, value: 100 },
                      { time: Date.now(), value: 120 }
                    ],
                    style: {
                      color: 'rgba(33, 150, 243, 0.9)',
                      lineWidth: 2,
                      lineStyle: 0
                    },
                    visible: true,
                    interactive: true
                  };
                  await ChartPersistenceManagerDB.saveDrawings([testDrawing]);
                  loadLocalDrawings();
                  await loadDbStats();
                }}
                size="sm"
                variant="secondary"
              >
                Add Test Drawing
              </Button>
              <Button
                onClick={async () => {
                  const drawings = await ChartPersistenceManagerDB.loadDrawings();
                  console.log('Loaded drawings:', drawings);
                  alert(`Loaded ${drawings.length} drawings from ${chartDbEnabled ? 'database' : 'localStorage'}`);
                }}
                size="sm"
                variant="secondary"
              >
                Load Drawings
              </Button>
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="analysis" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Analysis History</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">DB Enabled</p>
                <Badge variant={analysis.isDbEnabled ? 'default' : 'secondary'}>
                  {analysis.isDbEnabled ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Records</p>
                <p className="text-2xl font-bold">{analysis.records.length}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  await analysis.enableDbSync(chat.currentSessionId || undefined);
                  await loadDbStats();
                }}
                disabled={analysis.isDbEnabled}
                size="sm"
              >
                Enable Analysis DB
              </Button>
              <Button
                onClick={() => analysis.disableDbSync()}
                disabled={!analysis.isDbEnabled}
                size="sm"
                variant="outline"
              >
                Disable Analysis DB
              </Button>
              <Button
                onClick={async () => {
                  // Create a test analysis record
                  const recordId = await analysis.addRecord({
                    symbol: 'BTCUSDT',
                    interval: '4h',
                    type: 'support',
                    proposalData: {
                      price: 40000,
                      confidence: 0.85,
                      mlPredictions: {
                        bounceProb: 0.75,
                        breakProb: 0.25,
                      },
                    },
                  });
                  
                  // Add a touch event
                  await analysis.addTouchEvent(recordId, {
                    price: 40100,
                    result: 'bounce',
                    strength: 0.8,
                  });
                  
                  await loadDbStats();
                }}
                size="sm"
                variant="secondary"
              >
                Add Test Analysis
              </Button>
              <Button
                onClick={async () => {
                  await analysis.loadFromDatabase(chat.currentSessionId || undefined);
                }}
                disabled={!analysis.isDbEnabled}
                size="sm"
                variant="secondary"
              >
                Load from DB
              </Button>
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="debug" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button onClick={handleClearLocalStorage} variant="destructive">
              Clear Local Storage
            </Button>
            <Button 
              onClick={() => {
                console.log('Current chat state:', {
                  sessions: chat.sessions,
                  messages: chat.messagesBySession,
                  isDbEnabled: chat.isDbEnabled,
                });
              }}
              variant="outline"
            >
              Log State to Console
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Sessions List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Current Sessions</h2>
        {Object.keys(chat.sessions).length === 0 ? (
          <p className="text-muted-foreground">No sessions yet. Create one to get started!</p>
        ) : (
          <div className="space-y-2">
            {Object.values(chat.sessions).map(session => (
              <div 
                key={session.id} 
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  session.id === chat.currentSessionId ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
                onClick={() => chat.switchSession(session.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{session.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {chat.messagesBySession[session.id]?.length || 0} messages
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(session.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Error Display */}
      {chat.error && (
        <Card className="p-4 mt-4 border-red-500 bg-red-50">
          <p className="text-red-600">{chat.error}</p>
        </Card>
      )}
    </div>
  );
}