// File location: src/AutomationsPage/DynamicAutomationComponent.js
// Rule #1: When updating a file, if another file is going to be affected, update all affected files.
// Rule #2: File locations and these rules are added to the top of each file.
// Rule #3: Full code is provided for copy and paste.
// Rule #4: A breakdown of tasks is given.
// Rule #5: If a file is not available, a request for it is made.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../ThemeContext.js';
import { Eye, Lightbulb, Clock, Activity, AlertTriangle, Bug, Play, GitBranch } from 'lucide-react';
import AutomationDebugger from './AutomationDebugger.js';
import AlarmAutoArmComponent from './automations/AlarmAutoArmComponent.js';
import MotionLightAutomation from './automations/MotionLightAutomation.js';

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

// Dynamic component that adapts to any automation type and name
const DynamicAutomationComponent = ({ automation, haStatus, onStatusChange }) => {
  const { themeColors } = useTheme();

  // Always declare hooks first (no conditionals) - FIXED
  const [entityStates, setEntityStates] = useState({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [debugMessages, setDebugMessages] = useState([]);
  const [hasError, setHasError] = useState(false);

  // Refs for cleanup and component mounting state
  const isMountedRef = useRef(true);
  const pollIntervalRef = useRef(null);

  // Stable automation ID for dependencies
  const automationId = automation?.id;
  const automationType = automation?.type;
  const automationIsActive = automation?.is_active;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Debounced debug message addition
  const addDebugMessage = useCallback(
    debounce((message) => {
      if (!isMountedRef.current) return;
      
      const timestamp = new Date().toLocaleTimeString();
      setDebugMessages(prev => [
        { time: timestamp, message },
        ...prev.slice(0, 9)
      ]);
    }, 100),
    []
  );

  // Enhanced entity state update with proper error handling
  const updateEntityStates = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const haUrl = localStorage.getItem('ha_url');
      const haToken = localStorage.getItem('ha_token');

      if (!haUrl || !haToken) {
        addDebugMessage('No HA credentials found');
        setHasError(true);
        return;
      }

      const normalizedUrl = haUrl.replace(/\/$/, '');
      const finalUrl = !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://') 
        ? 'http://' + normalizedUrl 
        : normalizedUrl;

      const newStates = {};
      const allEntities = new Set();

      // Collect all entities from automation configuration
      automation?.triggers?.forEach(trigger => {
        if (trigger.entity_id) allEntities.add(trigger.entity_id);
      });

      automation?.conditions?.forEach(condition => {
        if (condition.entity_id) allEntities.add(condition.entity_id);
      });

      automation?.actions?.forEach(action => {
        if (action.entity_id) allEntities.add(action.entity_id);
      });

      if (automation?.settings?.motion_entity) allEntities.add(automation.settings.motion_entity);
      if (automation?.settings?.light_entity) allEntities.add(automation.settings.light_entity);

      // Create AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        for (const entityId of allEntities) {
          if (!isMountedRef.current) break;
          
          try {
            const response = await fetch(`${finalUrl}/api/states/${entityId}`, {
              headers: { 'Authorization': `Bearer ${haToken}` },
              signal: controller.signal
            });

            if (response.ok) {
              const data = await response.json();
              const previousState = entityStates[entityId]?.state;

              if (previousState && previousState !== data.state) {
                addDebugMessage(`${entityId}: ${previousState} → ${data.state}`);
              }

              newStates[entityId] = {
                state: data.state,
                lastChanged: data.last_changed,
                attributes: data.attributes,
                status: 'success'
              };
            } else {
              newStates[entityId] = { 
                state: 'error', 
                error: `HTTP ${response.status}`, 
                status: 'error' 
              };
              setHasError(true);
            }
          } catch (entityError) {
            if (entityError.name === 'AbortError') {
              newStates[entityId] = { 
                state: 'error', 
                error: 'Request timeout', 
                status: 'error' 
              };
            } else {
              newStates[entityId] = { 
                state: 'error', 
                error: entityError.message, 
                status: 'error' 
              };
            }
            setHasError(true);
          }
        }

        clearTimeout(timeoutId);

        if (isMountedRef.current) {
          setEntityStates(prev => ({ ...prev, ...newStates }));
          if (Object.keys(newStates).length > 0) {
            setHasError(false);
          }
        }

      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }

    } catch (error) {
      console.error('Failed to update entity states:', error);
      if (isMountedRef.current) {
        addDebugMessage(`Update error: ${error.message}`);
        setHasError(true);
      }
    }
  }, [automation, entityStates, addDebugMessage]);

  // Monitor automation based on its configuration with proper cleanup
  useEffect(() => {
    // Skip monitoring for alarm_auto_arm type as it has its own component
    if (automationType === 'alarm_auto_arm') return;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (automationIsActive && haStatus === 'connected' && isMountedRef.current) {
      setIsMonitoring(true);
      
      // Initial update
      updateEntityStates();
      
      // Set up polling with longer interval to avoid interference
      pollIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          updateEntityStates();
        }
      }, 5000);
    } else {
      setIsMonitoring(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [automationIsActive, haStatus, automationType, automationId, updateEntityStates]);

  // Helper functions
  const getEntityIcon = useCallback((entityId) => {
    if (!entityId) return <Activity size={14} className="text-gray-400" />;
    
    const domain = entityId.split('.')[0];
    switch (domain) {
      case 'binary_sensor':
        return <Eye size={14} className="text-blue-400" />;
      case 'light':
        return <Lightbulb size={14} className="text-yellow-400" />;
      case 'switch':
        return <Play size={14} className="text-green-400" />;
      case 'sensor':
        return <Activity size={14} className="text-purple-400" />;
      case 'automation':
        return <GitBranch size={14} className="text-cyan-400" />;
      default:
        return <Activity size={14} className="text-gray-400" />;
    }
  }, []);

  const getEntityDisplayName = useCallback((entityId) => {
    if (!entityId) return 'Unknown';
    return entityId.split('.')[1]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || entityId;
  }, []);

  const formatLastTriggered = useCallback((timestamp) => {
    if (!timestamp) return 'Never';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return 'Invalid time';
    }
  }, []);

  // Render conditionally after hooks are declared - FIXED
  if (automationType === 'alarm_auto_arm') {
    return (
      <AlarmAutoArmComponent 
        automation={automation}
        haStatus={haStatus}
        onStatusChange={onStatusChange}
      />
    );
  }

  if (automationType === 'motion_light') {
    return (
      <MotionLightAutomation 
        automation={automation}
        haStatus={haStatus}
        onStatusChange={onStatusChange}
      />
    );
  }

  // Don't render if automation is missing
  if (!automation) {
    return (
      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400" />
          <span className="text-red-400 text-sm">No automation data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Automation Title */}
      <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
        <div className="flex items-center gap-2 mb-2">
          <GitBranch size={14} className="text-cyan-400" />
          <span className={`text-xs font-medium ${themeColors.whiteText}`}>
            {automation.name}
          </span>
          {hasError && <AlertTriangle size={12} className="text-red-400" aria-label="Has errors" />}
        </div>
        <div className={`text-xs ${themeColors.secondaryText}`}>
          Type: {automation.type} • Triggers: {automation.triggers?.length || 0} • Actions: {automation.actions?.length || 0}
        </div>
      </div>

      {/* Entity States */}
      {Object.keys(entityStates).length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(entityStates).map(([entityId, state]) => (
            <div key={entityId} className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
              <div className="flex items-center gap-2 mb-1">
                {getEntityIcon(entityId)}
                <span className={`text-xs font-medium ${themeColors.whiteText} truncate`} title={entityId}>
                  {getEntityDisplayName(entityId)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  state.status === 'success' 
                    ? (state.state === 'on' || state.state === 'open' || state.state === 'home') 
                      ? 'bg-green-400' 
                      : 'bg-gray-600'
                    : 'bg-red-400'
                }`} aria-label={`${entityId} status: ${state.status}`}></div>
                <span className={`text-sm ${themeColors.primaryText} capitalize`}>
                  {state.status === 'success' ? state.state : state.error || 'Error'}
                </span>
              </div>
              {state.status === 'success' && state.lastChanged && (
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(state.lastChanged).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Config Summary */}
      <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={14} className="text-cyan-400" />
          <span className={`text-xs font-medium ${themeColors.whiteText}`}>Configuration</span>
        </div>
        <div className={`text-xs ${themeColors.secondaryText} space-y-1`}>
          {automation.triggers?.map((trigger, index) => (
            <p key={index}>
              Trigger {index + 1}: {trigger.platform} 
              {trigger.entity_id && ` (${getEntityDisplayName(trigger.entity_id)})`}
            </p>
          ))}
          {automation.conditions?.length > 0 && (
            <p>Conditions: {automation.conditions.length}</p>
          )}
          <p>Actions: {automation.actions?.length || 0}</p>
        </div>
      </div>

      {/* Activity */}
      <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className={isMonitoring ? 'text-green-400' : 'text-gray-400'} />
          <span className={`text-xs font-medium ${themeColors.whiteText}`}>Activity</span>
        </div>
        <div className={`text-xs ${themeColors.secondaryText}`}>
          <p>Triggered: {automation.trigger_count || 0} times</p>
          <p>Last: {formatLastTriggered(automation.last_triggered)}</p>
          {isMonitoring && (
            <p className="text-green-400">Monitoring {Object.keys(entityStates).length} entities</p>
          )}
        </div>
      </div>

      {/* Debug Messages */}
      {debugMessages.length > 0 && (
        <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
          <div className="flex items-center gap-2 mb-2">
            <Bug size={14} className="text-purple-400" />
            <span className={`text-xs font-medium ${themeColors.whiteText}`}>Recent Activity</span>
          </div>
          <div className={`text-xs ${themeColors.secondaryText} space-y-1 max-h-20 overflow-y-auto`}>
            {debugMessages.slice(0, 5).map((msg, index) => (
              <p key={index}>{msg.time}: {msg.message}</p>
            ))}
          </div>
        </div>
      )}

      {/* Connection Warning */}
      {haStatus !== 'connected' && (
        <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-yellow-400" />
            <span className="text-xs text-yellow-400">Not monitoring - HA disconnected</span>
          </div>
        </div>
      )}

      {/* Debug Component */}
      <AutomationDebugger automation={automation} haStatus={haStatus} />
    </div>
  );
};

export default DynamicAutomationComponent;