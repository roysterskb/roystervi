// File location: src/AutomationsPage/AutomationsPage.js
// Complete working AutomationsPage with fixed Add Alarm Auto-Arm button

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../ThemeContext.js';
import { COLORS, SPACING, TYPOGRAPHY } from '../global.js';
import { Workflow, Plus, Play, Square, Edit, Trash2, AlertCircle, CheckCircle, Clock, Settings, Database, RefreshCw, Shield } from 'lucide-react';
import AutomationService from '../services/AutomationService.js';
import AutomationEditor from './AutomationEditor.js';
import QuickSetup from './QuickSetup.js';
import DynamicAutomationComponent from './DynamicAutomationComponent.js';
import CollapsibleAutomationCard from './CollapsibleAutomationCard.js';

const AutomationsPage = ({ haStatus }) => {
  const { themeColors } = useTheme();
  const [automations, setAutomations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [message, setMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);
  const [hasError, setHasError] = useState(false);

  // Refs for cleanup
  const isMountedRef = useRef(true);
  const refreshIntervalRef = useRef(null);
  const debugIntervalRef = useRef(null);
  const messageTimeoutRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (debugIntervalRef.current) clearInterval(debugIntervalRef.current);
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, []);

  // Enhanced message handling with timeout management
  const setMessageWithTimeout = useCallback((msg, timeout = 3000) => {
    if (!isMountedRef.current) return;
    
    setMessage(msg);
    setHasError(msg.includes('Failed') || msg.includes('error'));
    
    // Clear existing timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    
    // Set new timeout
    messageTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setMessage('');
        setHasError(false);
      }
    }, timeout);
  }, []);

  // Enhanced automation loading with better error handling
  const loadAutomations = useCallback(async (showLoading = true) => {
    if (!isMountedRef.current) return;
    
    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      console.log('AutomationsPage: Loading automations from database...');
      
      // Initialize AutomationService
      await AutomationService.initialize();
      
      // Get fresh data from database
      const automationsData = await AutomationService.getAllAutomations();
      console.log('AutomationsPage: Loaded automations:', automationsData);
      
      if (!isMountedRef.current) return;
      
      // Validate data
      if (!Array.isArray(automationsData)) {
        throw new Error('Invalid data format received from database');
      }
      
      setAutomations(automationsData);
      setLastRefresh(new Date());
      setHasError(false);
      
      if (!showLoading && automationsData.length > 0) {
        console.log(`AutomationsPage: Refreshed ${automationsData.length} automations from database`);
      }
      
    } catch (error) {
      console.error('AutomationsPage: Failed to load automations:', error);
      
      if (!isMountedRef.current) return;
      
      const errorMessage = `Failed to load automations: ${error.message}`;
      setMessageWithTimeout(errorMessage, 5000);
      setHasError(true);
      
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [setMessageWithTimeout]);

  // Load automations on mount and set up refresh interval
  useEffect(() => {
    loadAutomations();
    
    // Refresh automations every 30 seconds
    refreshIntervalRef.current = setInterval(() => {
      if (!isLoading && !showEditor && isMountedRef.current) {
        loadAutomations(false); // Silent refresh
      }
    }, 30000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [loadAutomations, isLoading, showEditor]);

  // Get debug info every 5 seconds
  useEffect(() => {
    debugIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        try {
          const info = AutomationService.getDebugInfo();
          setDebugInfo(info);
        } catch (error) {
          console.error('AutomationsPage: Failed to get debug info:', error);
        }
      }
    }, 5000);

    return () => {
      if (debugIntervalRef.current) {
        clearInterval(debugIntervalRef.current);
      }
    };
  }, []);

  // FIXED: Add alarm automation creation function that actually works
  const createAlarmAutomation = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    console.log('AutomationsPage: createAlarmAutomation clicked - starting process...');
    setMessageWithTimeout('Creating alarm automation...', 2000);
    
    try {
      console.log('AutomationsPage: Initializing AutomationService...');
      await AutomationService.initialize();
      
      // Try to discover alarm entities
      let alarmEntity = 'alarm_control_panel.home_alarm'; // Default
      
      try {
        console.log('AutomationsPage: Discovering alarm entities...');
        const allEntities = await AutomationService.getAllHAEntities();
        const alarmEntities = allEntities.filter(e => e.entity_id.startsWith('alarm_control_panel.'));
        
        console.log('AutomationsPage: Found alarm entities:', alarmEntities.map(e => e.entity_id));
        
        if (alarmEntities.length > 0) {
          alarmEntity = alarmEntities[0].entity_id;
          console.log('AutomationsPage: Using alarm entity:', alarmEntity);
        } else {
          console.warn('AutomationsPage: No alarm entities found, using default');
          setMessageWithTimeout('Warning: No alarm entities found in Home Assistant. Using default entity ID.', 5000);
        }
      } catch (discoveryError) {
        console.warn('AutomationsPage: Entity discovery failed:', discoveryError);
        setMessageWithTimeout('Could not discover entities. Using default alarm entity.', 4000);
      }

      const alarmAutomationData = {
        name: 'Night Alarm Auto-Arm',
        description: 'Automatically arms the home alarm between 9PM and 7AM if not already armed',
        type: 'alarm_auto_arm',
        triggers: [
          {
            platform: 'time_pattern',
            seconds: 0
          }
        ],
        conditions: [
          {
            condition: 'template',
            value_template: '{{ now().hour >= 21 or now().hour < 7 }}'
          },
          {
            condition: 'state',
            entity_id: alarmEntity,
            state: 'disarmed'
          }
        ],
        actions: [
          {
            service: 'alarm_control_panel.alarm_arm_away',
            target: {
              entity_id: alarmEntity
            }
          }
        ],
        settings: {
          alarm_entity: alarmEntity,
          arm_time_start: '21:00',
          arm_time_end: '07:00',
          check_interval: 30,
          service_name: 'alarm_control_panel.alarm_arm_away'
        },
        is_active: false // Start disabled for user configuration
      };

      console.log('AutomationsPage: Saving alarm automation:', alarmAutomationData);
      const id = await AutomationService.saveAutomation(alarmAutomationData);
      console.log('AutomationsPage: Alarm automation created with ID:', id);
      
      if (isMountedRef.current) {
        await loadAutomations();
        setMessageWithTimeout(`✅ Night Alarm Auto-Arm created! Entity: ${alarmEntity}. Click Edit to customize, then Start to activate.`, 7000);
      }
    } catch (error) {
      console.error('AutomationsPage: Failed to create alarm automation:', error);
      if (isMountedRef.current) {
        setMessageWithTimeout(`❌ Failed to create alarm automation: ${error.message}`, 6000);
      }
    }
  }, [loadAutomations, setMessageWithTimeout]);

  // Enhanced quick setup save
  const handleQuickSetupSave = useCallback(async (automationData) => {
    if (!isMountedRef.current) return;
    
    try {
      console.log('AutomationsPage: Creating automation from QuickSetup:', automationData);
      
      if (!automationData || !automationData.name) {
        throw new Error('Invalid automation data');
      }
      
      const id = await AutomationService.saveAutomation(automationData);
      console.log('AutomationsPage: QuickSetup automation created with ID:', id);
      
      if (isMountedRef.current) {
        await loadAutomations();
        setMessageWithTimeout(`${automationData.name} automation created successfully!`, 4000);
      }
    } catch (error) {
      console.error('AutomationsPage: Failed to create automation:', error);
      if (isMountedRef.current) {
        setMessageWithTimeout(`Failed to create automation: ${error.message}`, 5000);
      }
    }
  }, [loadAutomations, setMessageWithTimeout]);

  const handleCreateAutomation = useCallback(() => {
    console.log('AutomationsPage: Opening custom automation editor...');
    setEditingAutomation(null);
    setShowEditor(true);
  }, []);

  const handleEditAutomation = useCallback((automation) => {
    console.log('AutomationsPage: Editing automation:', automation.name);
    setEditingAutomation(automation);
    setShowEditor(true);
  }, []);

  // Enhanced delete with confirmation
  const handleDeleteAutomation = useCallback(async (automationId) => {
    if (!automationId || !window.confirm('Are you sure you want to delete this automation? This action cannot be undone.')) {
      return;
    }

    if (!isMountedRef.current) return;

    try {
      console.log('AutomationsPage: Deleting automation:', automationId);
      await AutomationService.deleteAutomation(automationId);
      
      if (isMountedRef.current) {
        await loadAutomations();
        setMessageWithTimeout('Automation deleted successfully', 3000);
      }
    } catch (error) {
      console.error('AutomationsPage: Failed to delete automation:', error);
      if (isMountedRef.current) {
        setMessageWithTimeout(`Failed to delete automation: ${error.message}`, 4000);
      }
    }
  }, [loadAutomations, setMessageWithTimeout]);

  // Enhanced toggle with optimistic updates
  const handleToggleAutomation = useCallback(async (automationId) => {
    if (!automationId || !isMountedRef.current) return;

    try {
      const automation = automations.find(a => a.id === automationId);
      if (!automation) {
        throw new Error('Automation not found');
      }

      const newStatus = !automation.is_active;
      console.log('AutomationsPage: Toggling automation:', automation.name, 'to', newStatus);
      
      // Optimistic update
      setAutomations(prev => prev.map(a => 
        a.id === automationId 
          ? { ...a, is_active: newStatus, is_running: newStatus } 
          : a
      ));
      
      // Actual toggle
      await AutomationService.toggleAutomation(automationId, newStatus);
      
      if (isMountedRef.current) {
        setMessageWithTimeout(`Automation ${newStatus ? 'activated' : 'deactivated'} successfully`, 3000);
        
        // Refresh data after delay
        setTimeout(() => {
          if (isMountedRef.current) {
            loadAutomations(false);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('AutomationsPage: Failed to toggle automation:', error);
      
      if (isMountedRef.current) {
        // Rollback optimistic update
        await loadAutomations(false);
        setMessageWithTimeout(`Failed to toggle automation: ${error.message}`, 4000);
      }
    }
  }, [automations, loadAutomations, setMessageWithTimeout]);

  // Enhanced save automation
  const handleSaveAutomation = useCallback(async (automationData) => {
    if (!isMountedRef.current) return;

    try {
      if (!automationData || !automationData.name) {
        throw new Error('Invalid automation data: name is required');
      }

      console.log('AutomationsPage: Saving automation:', automationData.name);

      if (editingAutomation) {
        await AutomationService.updateAutomation(editingAutomation.id, automationData);
        if (isMountedRef.current) {
          setMessageWithTimeout('Automation updated successfully', 3000);
        }
      } else {
        await AutomationService.saveAutomation(automationData);
        if (isMountedRef.current) {
          setMessageWithTimeout('Automation created successfully', 3000);
        }
      }
      
      if (isMountedRef.current) {
        setShowEditor(false);
        setEditingAutomation(null);
        await loadAutomations();
      }
    } catch (error) {
      console.error('AutomationsPage: Failed to save automation:', error);
      if (isMountedRef.current) {
        setMessageWithTimeout(`Failed to save automation: ${error.message}`, 4000);
      }
    }
  }, [editingAutomation, loadAutomations, setMessageWithTimeout]);

  // Manual refresh
  const handleManualRefresh = useCallback(async () => {
    console.log('AutomationsPage: Manual refresh requested');
    await loadAutomations();
    setMessageWithTimeout('Automations refreshed', 2000);
  }, [loadAutomations, setMessageWithTimeout]);

  const getAutomationComponent = useCallback((automation) => {
    return (
      <DynamicAutomationComponent
        key={automation.id}
        automation={automation}
        haStatus={haStatus}
        onStatusChange={loadAutomations}
      />
    );
  }, [haStatus, loadAutomations]);

  return (
    <div className={`${SPACING.containerPadding} ${SPACING.verticalSpace}`}>
      {/* Header with Actions */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className={`${themeColors.secondaryText} mb-2`}>
            Create and manage smart home automations for your Home Assistant system
          </p>
          
          {/* Debug Info Display */}
          {debugInfo.totalAutomations > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <span className={`${themeColors.secondaryText} flex items-center gap-1`}>
                <Database size={14} className="text-blue-400" />
                Total: {debugInfo.totalAutomations}
              </span>
              <span className={`${themeColors.secondaryText} flex items-center gap-1`}>
                <CheckCircle size={14} className="text-green-400" />
                Running: {debugInfo.activeAutomations}
              </span>
              <span className={`text-xs ${themeColors.secondaryText}`}>
                Database: {debugInfo.isInitialized ? 'Connected' : 'Initializing'}
              </span>
              {lastRefresh && (
                <span className={`text-xs ${themeColors.secondaryText}`}>
                  Last update: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={createAlarmAutomation}
            className={`flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors`}
            aria-label="Create night alarm auto-arm automation"
          >
            <Shield size={16} />
            Add Alarm Auto-Arm
          </button>
          
          <button
            onClick={handleManualRefresh}
            disabled={isLoading || isRefreshing}
            aria-label="Refresh automations from database"
            className={`flex items-center gap-2 px-4 py-2 ${themeColors.tertiaryBg} ${themeColors.primaryText} hover:${themeColors.hoverBg} rounded-lg font-medium transition-colors disabled:opacity-50`}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
          <button
            onClick={handleCreateAutomation}
            aria-label="Create new custom automation"
            className={`flex items-center gap-2 px-4 py-2 ${COLORS.brandBg} hover:${COLORS.brandBgHover} text-white rounded-lg font-medium transition-colors`}
          >
            <Plus size={18} />
            New Automation
          </button>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`mb-6 p-3 rounded-lg border-l-4 ${
          hasError
            ? 'bg-red-500/10 border-red-500 text-red-400'
            : 'bg-green-500/10 border-green-500 text-green-400'
        }`} role="alert">
          {message}
        </div>
      )}

      {/* Connection Warning */}
      {haStatus !== 'connected' && (
        <div className={`mb-6 p-4 ${themeColors.secondaryBg} rounded-xl border-l-4 border-yellow-500`} role="alert">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={20} className="text-yellow-400" />
            <h3 className={`font-semibold ${themeColors.whiteText}`}>Home Assistant Not Connected</h3>
          </div>
          <p className={`text-sm ${themeColors.secondaryText}`}>
            Automations require a connection to Home Assistant to function. Please check your settings.
          </p>
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <div className="flex justify-center items-center h-32" role="status" aria-label="Loading automations">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      ) : automations.length === 0 ? (
        <div className="space-y-4">
          <QuickSetup 
            onAutomationCreated={handleQuickSetupSave}
            onCreateCustom={handleCreateAutomation}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Automation Stats */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-4">
              <span className={`text-sm ${themeColors.secondaryText}`}>
                {automations.length} automation{automations.length !== 1 ? 's' : ''}
              </span>
              {lastRefresh && (
                <span className={`text-xs ${themeColors.secondaryText}`}>
                  Updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Automation Cards */}
          {automations.map((automation) => (
            <CollapsibleAutomationCard
              key={automation.id}
              automation={automation}
              haStatus={haStatus}
              onToggle={handleToggleAutomation}
              onEdit={handleEditAutomation}
              onDelete={handleDeleteAutomation}
              getAutomationComponent={getAutomationComponent}
            />
          ))}
        </div>
      )}

      {/* Automation Editor Modal */}
      {showEditor && (
        <AutomationEditor
          isOpen={showEditor}
          onClose={() => {
            setShowEditor(false);
            setEditingAutomation(null);
          }}
          onSave={handleSaveAutomation}
          automation={editingAutomation}
          haStatus={haStatus}
        />
      )}
    </div>
  );
};

export default AutomationsPage;