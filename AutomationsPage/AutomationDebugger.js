// File location: src/AutomationsPage/AutomationDebugger.js
// Rule #1: When updating a file, if another file is going to be affected, update all affected files.
// Rule #2: File locations and these rules are added to the top of each file.
// Rule #3: Full code is provided for copy and paste.
// Rule #4: A breakdown of tasks is given.
// Rule #5: If a file is not available, a request for it is made.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../ThemeContext.js';
import { Bug, Play, Eye, Lightbulb, RefreshCw, AlertTriangle, Monitor, Database, Activity } from 'lucide-react';
import AutomationService from '../services/AutomationService.js';

const MAX_HISTORY = 20;
const MAX_LOGS = 50;
const POLL_INTERVAL = 2000;
const REQUEST_TIMEOUT = 5000;

// Debounce utility for API calls
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const AutomationDebugger = ({ automation, haStatus }) => {
  const { themeColors } = useTheme();
  const [debugInfo, setDebugInfo] = useState({});
  const [isDebugging, setIsDebugging] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [automationLogs, setAutomationLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  // Real-time monitoring states
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [realtimeStates, setRealtimeStates] = useState({});
  const [stateHistory, setStateHistory] = useState([]);
  const [hasError, setHasError] = useState(false);

  // Refs for cleanup
  const runnerPollingRef = useRef(null);
  const monitoringRef = useRef(null);
  const isMountedRef = useRef(true);

  // Stable automation ID for dependencies
  const automationId = automation?.id;
  const automationRunner = automation?.runner;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (runnerPollingRef.current) clearInterval(runnerPollingRef.current);
      if (monitoringRef.current) clearInterval(monitoringRef.current);
    };
  }, []);

  // Runner internal state polling with proper cleanup
  useEffect(() => {
    if (runnerPollingRef.current) {
      clearInterval(runnerPollingRef.current);
    }

    if (automationRunner && typeof automationRunner.getDebugInfo === 'function') {
      const updateRunnerDebug = () => {
        if (!isMountedRef.current) return;
        
        try {
          const info = automationRunner.getDebugInfo();
          if (isMountedRef.current) {
            setDebugInfo(info);
            setHasError(false);
          }
        } catch (err) {
          console.error('Runner debug fetch failed:', err);
          if (isMountedRef.current) {
            setHasError(true);
          }
        }
      };

      updateRunnerDebug();
      runnerPollingRef.current = setInterval(updateRunnerDebug, POLL_INTERVAL);
    }

    return () => {
      if (runnerPollingRef.current) {
        clearInterval(runnerPollingRef.current);
        runnerPollingRef.current = null;
      }
    };
  }, [automationRunner]);

  // Load automation logs with error handling
  const loadAutomationLogs = useCallback(async () => {
    if (!automationId) return;
    
    setIsLoadingLogs(true);
    setHasError(false);
    
    try {
      const logs = await AutomationService.getAutomationLogs(automationId, MAX_LOGS);
      
      if (isMountedRef.current) {
        setAutomationLogs(Array.isArray(logs) ? logs : []);
        addStateHistory('Loaded automation logs from database', 'success');
      }
    } catch (error) {
      console.error('Failed to load automation logs:', error);
      if (isMountedRef.current) {
        setHasError(true);
        addStateHistory(`Failed to load logs: ${error.message}`, 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingLogs(false);
      }
    }
  }, [automationId]);

  // Load logs on mount
  useEffect(() => {
    if (automationId) {
      loadAutomationLogs();
    }
  }, [automationId, loadAutomationLogs]);

  // Debounced state update function
  const debouncedUpdateStates = useCallback(
    debounce(async () => {
      if (!isMountedRef.current) return;
      await updateRealtimeStates();
    }, 1000),
    []
  );

  // Real-time monitoring with proper cleanup and error handling
  useEffect(() => {
    if (monitoringRef.current) {
      clearInterval(monitoringRef.current);
    }

    if (isMonitoring && haStatus === 'connected' && automationId) {
      const startMonitoring = async () => {
        await debouncedUpdateStates();
      };
      
      startMonitoring();
      monitoringRef.current = setInterval(debouncedUpdateStates, POLL_INTERVAL);
    }

    return () => {
      if (monitoringRef.current) {
        clearInterval(monitoringRef.current);
        monitoringRef.current = null;
      }
    };
  }, [isMonitoring, haStatus, automationId, debouncedUpdateStates]);

  const updateRealtimeStates = async () => {
    if (!automation?.settings || !isMountedRef.current) return;

    const newStates = {};
    setHasError(false);
    
    try {
      const haUrl = localStorage.getItem('ha_url');
      const haToken = localStorage.getItem('ha_token');
      
      if (!haUrl || !haToken) {
        addStateHistory('HA credentials not found', 'error');
        setHasError(true);
        return;
      }

      const normalizedUrl = haUrl.replace(/\/$/, '');
      const finalUrl = !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://') 
        ? 'http://' + normalizedUrl 
        : normalizedUrl;

      // Create AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        // Motion sensor fetch with timeout
        if (automation.settings.motion_entity) {
          try {
            const res = await fetch(`${finalUrl}/api/states/${automation.settings.motion_entity}`, {
              headers: { 'Authorization': `Bearer ${haToken}` },
              signal: controller.signal
            });
            
            if (res.ok) {
              const data = await res.json();
              const newMotion = data.state;
              
              if (realtimeStates.motion && realtimeStates.motion.state !== newMotion) {
                addStateHistory(`Motion: ${realtimeStates.motion.state} → ${newMotion}`, 'state_change');
              }
              
              newStates.motion = { 
                state: newMotion, 
                lastChanged: data.last_changed, 
                status: 'success',
                attributes: data.attributes 
              };
            } else {
              newStates.motion = { 
                state: 'error', 
                error: `HTTP ${res.status}`, 
                status: 'error' 
              };
              setHasError(true);
            }
          } catch (err) {
            if (err.name === 'AbortError') {
              newStates.motion = { state: 'error', error: 'Request timeout', status: 'error' };
            } else {
              newStates.motion = { state: 'error', error: err.message, status: 'error' };
            }
            setHasError(true);
          }
        }

        // Light fetch with timeout
        if (automation.settings.light_entity) {
          try {
            const res = await fetch(`${finalUrl}/api/states/${automation.settings.light_entity}`, {
              headers: { 'Authorization': `Bearer ${haToken}` },
              signal: controller.signal
            });
            
            if (res.ok) {
              const data = await res.json();
              const newLight = data.state;
              
              if (realtimeStates.light && realtimeStates.light.state !== newLight) {
                addStateHistory(`Light: ${realtimeStates.light.state} → ${newLight}`, 'state_change');
              }
              
              newStates.light = { 
                state: newLight, 
                lastChanged: data.last_changed, 
                status: 'success',
                attributes: data.attributes 
              };
            } else {
              newStates.light = { 
                state: 'error', 
                error: `HTTP ${res.status}`, 
                status: 'error' 
              };
              setHasError(true);
            }
          } catch (err) {
            if (err.name === 'AbortError') {
              newStates.light = { state: 'error', error: 'Request timeout', status: 'error' };
            } else {
              newStates.light = { state: 'error', error: err.message, status: 'error' };
            }
            setHasError(true);
          }
        }

        clearTimeout(timeoutId);
        
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setRealtimeStates(prev => ({ ...prev, ...newStates }));
        }

      } catch (err) {
        clearTimeout(timeoutId);
        console.error('Failed to update realtime states:', err);
        if (isMountedRef.current) {
          addStateHistory(`Monitor error: ${err.message}`, 'error');
          setHasError(true);
        }
      }
    } catch (err) {
      console.error('Failed to update realtime states:', err);
      if (isMountedRef.current) {
        addStateHistory(`Monitor error: ${err.message}`, 'error');
        setHasError(true);
      }
    }
  };

  const addStateHistory = useCallback((message, type = 'info') => {
    if (!isMountedRef.current) return;
    
    const timestamp = new Date().toLocaleTimeString();
    setStateHistory(prev => [
      { timestamp, message, type },
      ...prev.slice(0, MAX_HISTORY - 1)
    ]);
  }, []);

  const testLightService = useCallback(async () => {
    if (!automation?.settings?.light_entity || haStatus !== 'connected') return;
    
    addStateHistory('Testing light service call...', 'info');
    
    try {
      await AutomationService.callHAService('turn_on', 'light', automation.settings.light_entity);
      addStateHistory('Light service call successful', 'success');
      
      // Update states after service call
      setTimeout(() => {
        if (isMountedRef.current) {
          debouncedUpdateStates();
        }
      }, 1000);
    } catch (err) {
      addStateHistory(`Light service failed: ${err.message}`, 'error');
      setHasError(true);
    }
  }, [automation?.settings?.light_entity, haStatus, addStateHistory, debouncedUpdateStates]);

  const runDiagnostics = useCallback(async () => {
    setIsDebugging(true);
    setTestResults([]);
    setHasError(false);

    const results = [];

    // Test HA Connection
    try {
      results.push({ id: 'ha_connection', name: 'HA Connection', status: 'running', message: 'Testing...' });
      setTestResults([...results]);
      
      if (haStatus === 'connected') {
        results[0] = { id: 'ha_connection', name: 'HA Connection', status: 'passed', message: 'Connected' };
      } else {
        results[0] = { id: 'ha_connection', name: 'HA Connection', status: 'failed', message: `Status: ${haStatus}` };
        setHasError(true);
      }
      setTestResults([...results]);
    } catch (error) {
      results[0] = { id: 'ha_connection', name: 'HA Connection', status: 'failed', message: error.message };
      setTestResults([...results]);
      setHasError(true);
    }

    // Test Motion Entity
    if (automation?.settings?.motion_entity) {
      try {
        results.push({ id: 'motion_entity', name: 'Motion Entity', status: 'running', message: 'Testing...' });
        setTestResults([...results]);
        
        const motionState = await AutomationService.getHAEntityState(automation.settings.motion_entity);
        results[results.length - 1] = { 
          id: 'motion_entity', 
          name: 'Motion Entity', 
          status: 'passed', 
          message: `State: ${motionState.state}` 
        };
        setTestResults([...results]);
      } catch (error) {
        results[results.length - 1] = { 
          id: 'motion_entity', 
          name: 'Motion Entity', 
          status: 'failed', 
          message: error.message 
        };
        setTestResults([...results]);
        setHasError(true);
      }
    }

    // Test Light Entity
    if (automation?.settings?.light_entity) {
      try {
        results.push({ id: 'light_entity', name: 'Light Entity', status: 'running', message: 'Testing...' });
        setTestResults([...results]);
        
        const lightState = await AutomationService.getHAEntityState(automation.settings.light_entity);
        results[results.length - 1] = { 
          id: 'light_entity', 
          name: 'Light Entity', 
          status: 'passed', 
          message: `State: ${lightState.state}` 
        };
        setTestResults([...results]);
      } catch (error) {
        results[results.length - 1] = { 
          id: 'light_entity', 
          name: 'Light Entity', 
          status: 'failed', 
          message: error.message 
        };
        setTestResults([...results]);
        setHasError(true);
      }

      // Test Light Service if entity test passed
      if (results.find(r => r.id === 'light_entity')?.status === 'passed') {
        try {
          results.push({ id: 'light_service', name: 'Light Service', status: 'running', message: 'Testing...' });
          setTestResults([...results]);
          
          await AutomationService.callHAService('turn_on', 'light', automation.settings.light_entity);
          results[results.length - 1] = { 
            id: 'light_service', 
            name: 'Light Service', 
            status: 'passed', 
            message: 'Service call successful' 
          };
          setTestResults([...results]);
        } catch (error) {
          results[results.length - 1] = { 
            id: 'light_service', 
            name: 'Light Service', 
            status: 'failed', 
            message: error.message 
          };
          setTestResults([...results]);
          setHasError(true);
        }
      }
    }

    setIsDebugging(false);
  }, [automation?.settings, haStatus]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <div className="w-2 h-2 bg-green-500 rounded-full" aria-label="Test passed"></div>;
      case 'failed':
        return <div className="w-2 h-2 bg-red-500 rounded-full" aria-label="Test failed"></div>;
      case 'running':
        return <RefreshCw size={12} className="text-yellow-500 animate-spin" aria-label="Test running" />;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full" aria-label="Test pending"></div>;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'passed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'running':
        return 'text-yellow-400';
      default:
        return themeColors.secondaryText;
    }
  };

  const getHistoryColor = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'state_change':
        return 'text-cyan-400';
      default:
        return themeColors.secondaryText;
    }
  };

  const formatTime = (iso) => {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleTimeString();
    } catch {
      return 'Invalid time';
    }
  };

  const formatLogTime = (iso) => {
    if (!iso) return 'Unknown time';
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
    } catch {
      return 'Invalid time';
    }
  };

  // Don't render if automation is missing
  if (!automation) {
    return (
      <div className={`${themeColors.tertiaryBg} p-4 rounded-lg mt-4`}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <span className="text-red-400">No automation data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${themeColors.tertiaryBg} p-4 rounded-lg mt-4`}>
      {/* Header with control buttons */}
      <div className="flex justify-between items-center mb-4">
        <h5 className={`text-sm font-medium ${themeColors.whiteText} flex items-center gap-2`}>
          <Bug size={16} className="text-purple-400" />
          Debug & Monitoring
          {hasError && <AlertTriangle size={14} className="text-red-400" aria-label="Has errors" />}
        </h5>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            disabled={haStatus !== 'connected'}
            aria-label={isMonitoring ? 'Stop monitoring entities' : 'Start monitoring entities'}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
              isMonitoring 
                ? 'bg-green-600 text-white' 
                : `${themeColors.secondaryBg} ${themeColors.primaryText} hover:bg-green-600 hover:text-white`
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Monitor size={12} />
            {isMonitoring ? 'Stop Monitor' : 'Start Monitor'}
          </button>
          
          <button
            onClick={runDiagnostics}
            disabled={isDebugging || haStatus !== 'connected'}
            aria-label="Run diagnostic tests"
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${themeColors.secondaryBg} ${themeColors.primaryText} hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isDebugging ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
            {isDebugging ? 'Testing...' : 'Run Tests'}
          </button>
          
          <button
            onClick={loadAutomationLogs}
            disabled={isLoadingLogs}
            aria-label="Refresh automation logs from database"
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${themeColors.secondaryBg} ${themeColors.primaryText} hover:bg-purple-600 hover:text-white transition-colors disabled:opacity-50`}
          >
            {isLoadingLogs ? <RefreshCw size={12} className="animate-spin" /> : <Database size={12} />}
            {isLoadingLogs ? 'Loading...' : 'Refresh Logs'}
          </button>
        </div>
      </div>

      {/* Runner Debug Info */}
      {debugInfo && Object.keys(debugInfo).length > 0 && (
        <div className="mb-4">
          <h6 className={`text-xs font-medium ${themeColors.whiteText} mb-2 flex items-center gap-1`}>
            <Activity size={12} className="text-blue-400" />
            Runner Status
          </h6>
          <div className={`${themeColors.secondaryBg} rounded p-3 overflow-x-auto`}>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className={`${themeColors.secondaryText}`}>Running:</span>
                <span className={`ml-2 ${debugInfo.isRunning ? 'text-green-400' : 'text-red-400'}`}>
                  {debugInfo.isRunning ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className={`${themeColors.secondaryText}`}>Motion State:</span>
                <span className={`ml-2 ${themeColors.whiteText}`}>
                  {debugInfo.lastMotionState || 'Unknown'}
                </span>
              </div>
              <div>
                <span className={`${themeColors.secondaryText}`}>Errors:</span>
                <span className={`ml-2 ${debugInfo.errorCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {debugInfo.errorCount || 0}
                </span>
              </div>
              <div>
                <span className={`${themeColors.secondaryText}`}>Success Count:</span>
                <span className={`ml-2 text-green-400`}>
                  {debugInfo.consecutiveSuccesses || 0}
                </span>
              </div>
            </div>
            
            {debugInfo.lastSuccessfulPoll && (
              <div className="mt-2 text-xs">
                <span className={`${themeColors.secondaryText}`}>Last Poll:</span>
                <span className={`ml-2 ${themeColors.whiteText}`}>
                  {formatTime(debugInfo.lastSuccessfulPoll)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Realtime States */}
      {Object.keys(realtimeStates).length > 0 && (
        <div className="mb-4">
          <h6 className={`text-xs font-medium ${themeColors.whiteText} mb-2`}>Entity States</h6>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(realtimeStates).map(([key, val]) => (
              <div key={key} className={`${themeColors.secondaryBg} p-2 rounded`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium capitalize text-xs">{key}</span>
                  <div className={`w-2 h-2 rounded-full ${
                    val.status === 'success' ? 'bg-green-400' : 'bg-red-400'
                  }`} aria-label={`${key} status: ${val.status}`}></div>
                </div>
                {val.state === 'error' ? (
                  <span className="text-red-400 text-xs">{val.error || 'Error'}</span>
                ) : (
                  <div>
                    <span className="text-green-400 text-sm font-medium capitalize">{val.state}</span>
                    <div className="text-xs text-gray-400">{formatTime(val.lastChanged)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="mb-4">
          <h6 className={`text-xs font-medium ${themeColors.whiteText} mb-2`}>Diagnostic Results</h6>
          <div className="space-y-2">
            {testResults.map(result => (
              <div key={result.id} className={`${themeColors.secondaryBg} p-2 rounded flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.status)}
                  <span className={`text-xs font-medium ${themeColors.whiteText}`}>{result.name}</span>
                </div>
                <span className={`text-xs ${getStatusColor(result.status)}`}>{result.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State History */}
      {stateHistory.length > 0 && (
        <div className="mb-4">
          <h6 className={`text-xs font-medium ${themeColors.whiteText} mb-2`}>Recent Activity</h6>
          <div className={`${themeColors.secondaryBg} rounded p-2 max-h-32 overflow-y-auto`}>
            <div className="space-y-1">
              {stateHistory.slice(0, 10).map((entry, index) => (
                <div key={index} className="flex justify-between items-center text-xs">
                  <span className={getHistoryColor(entry.type)}>{entry.message}</span>
                  <span className={`${themeColors.secondaryText} text-xs`}>{entry.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Database Logs */}
      {automationLogs.length > 0 && (
        <div className="mb-4">
          <h6 className={`text-xs font-medium ${themeColors.whiteText} mb-2 flex items-center gap-1`}>
            <Database size={12} className="text-green-400" />
            Database Logs ({automationLogs.length})
          </h6>
          <div className={`${themeColors.secondaryBg} rounded p-2 max-h-40 overflow-y-auto`}>
            <div className="space-y-1">
              {automationLogs.slice(0, 15).map((log, index) => (
                <div key={index} className="text-xs border-b border-gray-600 pb-1 mb-1">
                  <div className="flex justify-between items-start">
                    <span className={`font-medium capitalize ${
                      log.event_type === 'error' ? 'text-red-400' :
                      log.event_type === 'triggered' ? 'text-green-400' :
                      log.event_type === 'started' ? 'text-blue-400' :
                      log.event_type === 'stopped' ? 'text-orange-400' :
                      themeColors.whiteText
                    }`}>
                      {log.event_type}
                    </span>
                    <span className={`${themeColors.secondaryText} text-xs`}>
                      {formatLogTime(log.created_at)}
                    </span>
                  </div>
                  <div className={`${themeColors.secondaryText} mt-1`}>
                    {log.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {haStatus === 'connected' && automation.settings?.light_entity && (
        <div className="flex gap-2">
          <button
            onClick={testLightService}
            aria-label="Test light service call"
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-yellow-600 hover:bg-yellow-700 text-white transition-colors`}
          >
            <Lightbulb size={12} />
            Test Light
          </button>
          
          <button
            onClick={debouncedUpdateStates}
            aria-label="Refresh entity states"
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${themeColors.secondaryBg} ${themeColors.primaryText} hover:bg-cyan-600 hover:text-white transition-colors`}
          >
            <RefreshCw size={12} />
            Refresh States
          </button>
        </div>
      )}

      {/* Connection Warning */}
      {haStatus !== 'connected' && (
        <div className="mt-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-yellow-400" />
            <span className="text-xs text-yellow-400">Debug tools require Home Assistant connection</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationDebugger;