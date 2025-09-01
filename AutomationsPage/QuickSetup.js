// File location: src/AutomationsPage/QuickSetup.js
// Updated to include entity discovery and flexible entity configuration

import React, { useState, useCallback, useRef } from 'react';
import { useTheme } from '../ThemeContext.js';
import { Zap, Eye, Lightbulb, RefreshCw, Search, Settings, CheckCircle } from 'lucide-react';
import EntityDiscovery from './EntityDiscovery.js';
import AutomationService from '../services/AutomationService.js';

const QuickSetup = ({ onAutomationCreated, onCreateCustom }) => {
  const { themeColors } = useTheme();
  const [showEntityDiscovery, setShowEntityDiscovery] = useState(false);
  const [isTestingEntities, setIsTestingEntities] = useState(false);
  const [entityTestResults, setEntityTestResults] = useState(null);
  const [hasError, setHasError] = useState(false);
  
  // Selected entities for automation
  const [selectedMotionEntity, setSelectedMotionEntity] = useState('');
  const [selectedLightEntity, setSelectedLightEntity] = useState('');
  const [selectedAlarmEntity, setSelectedAlarmEntity] = useState('');
  
  // Common entity suggestions based on typical naming patterns
  const [entitySuggestions, setEntitySuggestions] = useState({
    motion: [],
    lights: [],
    alarms: []
  });

  // Ref for tracking component mount state
  const isMountedRef = useRef(true);

  // Handle discovered entities
  const handleEntitiesDiscovered = useCallback((entities) => {
    const suggestions = {
      motion: entities.filter(e => 
        e.entity_id.startsWith('binary_sensor.') && 
        (e.entity_id.includes('motion') || e.attributes.device_class === 'motion')
      ),
      lights: entities.filter(e => 
        (e.entity_id.startsWith('light.') || e.entity_id.startsWith('switch.')) &&
        !e.entity_id.includes('motion')
      ),
      alarms: entities.filter(e => e.entity_id.startsWith('alarm_control_panel.'))
    };
    
    setEntitySuggestions(suggestions);
    
    // Auto-select common entities if found
    if (suggestions.motion.some(e => e.entity_id.includes('den'))) {
      const denMotion = suggestions.motion.find(e => e.entity_id.includes('den'));
      setSelectedMotionEntity(denMotion.entity_id);
    }
    
    if (suggestions.lights.some(e => e.entity_id.includes('den'))) {
      const denLight = suggestions.lights.find(e => e.entity_id.includes('den'));
      setSelectedLightEntity(denLight.entity_id);
    }
    
    if (suggestions.alarms.length > 0) {
      setSelectedAlarmEntity(suggestions.alarms[0].entity_id);
    }
    
    console.log('Entity suggestions updated:', suggestions);
  }, []);

  // Enhanced entity testing with selected entities
  const testSelectedEntities = useCallback(async () => {
    setIsTestingEntities(true);
    setEntityTestResults(null);
    setHasError(false);
    
    try {
      const results = { motion: null, light: null, alarm: null };

      // Test motion entity
      if (selectedMotionEntity) {
        try {
          console.log('Testing motion entity:', selectedMotionEntity);
          const motionState = await AutomationService.getHAEntityState(selectedMotionEntity);
          results.motion = { 
            status: 'found', 
            state: motionState.state, 
            entity: motionState,
            lastChanged: motionState.last_changed 
          };
          console.log('Motion entity found:', motionState.state);
        } catch (motionError) {
          results.motion = { status: 'error', error: motionError.message };
          console.error('Motion entity test error:', motionError);
        }
      }

      // Test light entity
      if (selectedLightEntity) {
        try {
          console.log('Testing light entity:', selectedLightEntity);
          const lightState = await AutomationService.getHAEntityState(selectedLightEntity);
          results.light = { 
            status: 'found', 
            state: lightState.state, 
            entity: lightState,
            lastChanged: lightState.last_changed,
            attributes: lightState.attributes 
          };
          console.log('Light entity found:', lightState.state);
          
          // Test light service if entity exists
          try {
            console.log('Testing light service call');
            await AutomationService.callHAService('turn_on', 'light', selectedLightEntity);
            results.lightService = { status: 'success', message: 'Service call successful' };
            console.log('Light service test successful');
          } catch (serviceError) {
            results.lightService = { status: 'failed', error: serviceError.message };
            console.log('Light service test failed:', serviceError);
          }
        } catch (lightError) {
          results.light = { status: 'error', error: lightError.message };
          console.error('Light entity test error:', lightError);
        }
      }

      // Test alarm entity
      if (selectedAlarmEntity) {
        try {
          console.log('Testing alarm entity:', selectedAlarmEntity);
          const alarmState = await AutomationService.getHAEntityState(selectedAlarmEntity);
          results.alarm = { 
            status: 'found', 
            state: alarmState.state, 
            entity: alarmState,
            lastChanged: alarmState.last_changed,
            attributes: alarmState.attributes 
          };
          console.log('Alarm entity found:', alarmState.state);
        } catch (alarmError) {
          results.alarm = { status: 'error', error: alarmError.message };
          console.error('Alarm entity test error:', alarmError);
        }
      }

      if (isMountedRef.current) {
        setEntityTestResults(results);
        
        // Set error state if any critical tests failed
        const hasCriticalErrors = Object.values(results).some(r => r && r.status === 'error');
        setHasError(hasCriticalErrors);
      }

    } catch (error) {
      console.error('Entity testing failed:', error);
      if (isMountedRef.current) {
        setEntityTestResults({ error: error.message });
        setHasError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsTestingEntities(false);
      }
    }
  }, [selectedMotionEntity, selectedLightEntity, selectedAlarmEntity]);

  // Create motion light automation with selected entities
  const createMotionLightAutomation = useCallback(async () => {
    if (!onAutomationCreated) {
      console.error('onAutomationCreated callback not provided');
      return;
    }

    if (!selectedMotionEntity || !selectedLightEntity) {
      alert('Please select both motion sensor and light entities first');
      return;
    }

    try {
      const automationData = {
        name: `Motion Light (${selectedLightEntity.split('.')[1]})`,
        description: `Turn on light when motion is detected, turn off 15 seconds after motion stops`,
        type: 'motion_light',
        triggers: [
          {
            platform: 'state',
            entity_id: selectedMotionEntity,
            from: 'off',
            to: 'on'
          }
        ],
        conditions: [],
        actions: [
          {
            service: 'light.turn_on',
            entity_id: selectedLightEntity
          },
          {
            wait_for_trigger: {
              platform: 'state',
              entity_id: selectedMotionEntity,
              from: 'on',
              to: 'off',
              for: { seconds: 15 }
            }
          },
          {
            service: 'light.turn_off',
            entity_id: selectedLightEntity
          }
        ],
        settings: {
          motion_entity: selectedMotionEntity,
          light_entity: selectedLightEntity,
          delay_seconds: 15,
          reset_on_motion: true
        },
        is_active: true
      };

      await onAutomationCreated(automationData);
    } catch (error) {
      console.error('Failed to create motion light automation:', error);
      throw error;
    }
  }, [selectedMotionEntity, selectedLightEntity, onAutomationCreated]);

  // Create alarm automation with selected entity
  const createAlarmAutomation = useCallback(async () => {
    if (!onAutomationCreated) {
      console.error('onAutomationCreated callback not provided');
      return;
    }

    if (!selectedAlarmEntity) {
      alert('Please select an alarm control panel entity first');
      return;
    }

    try {
      const automationData = {
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
            entity_id: selectedAlarmEntity,
            state: 'disarmed'
          }
        ],
        actions: [
          {
            service: 'alarm_control_panel.alarm_arm_away',
            target: {
              entity_id: selectedAlarmEntity
            }
          }
        ],
        settings: {
          alarm_entity: selectedAlarmEntity,
          arm_time_start: '21:00',
          arm_time_end: '07:00',
          check_interval: 30,
          service_name: 'alarm_control_panel.alarm_arm_away'
        },
        is_active: false
      };

      await onAutomationCreated(automationData);
    } catch (error) {
      console.error('Failed to create alarm automation:', error);
      throw error;
    }
  }, [selectedAlarmEntity, onAutomationCreated]);

  // Enhanced custom automation creation
  const handleCreateCustom = useCallback(() => {
    if (!onCreateCustom) {
      console.error('onCreateCustom callback not provided');
      return;
    }
    
    try {
      onCreateCustom();
    } catch (error) {
      console.error('Failed to create custom automation:', error);
    }
  }, [onCreateCustom]);

  // Component cleanup
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper function to get friendly name
  const getFriendlyName = useCallback((entityId) => {
    if (!entityId) return '';
    return entityId.split('.')[1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, []);

  return (
    <div className={`${themeColors.secondaryBg} p-8 rounded-2xl text-center ${themeColors.cardShadow}`}>
      <Zap size={48} className="text-cyan-400 mx-auto mb-4" aria-hidden="true" />
      <h3 className={`text-xl font-bold ${themeColors.whiteText} mb-3`}>Smart Automation Setup</h3>
      <p className={`${themeColors.secondaryText} mb-6 max-w-md mx-auto`}>
        Discover your Home Assistant entities and create automations with the correct entity IDs
      </p>

      {/* Entity Discovery Section */}
      <div className={`${themeColors.tertiaryBg} p-4 rounded-lg mb-6 text-left`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`font-semibold ${themeColors.whiteText} flex items-center gap-2`}>
            <Search size={16} className="text-cyan-400" />
            Entity Discovery
          </h4>
          <button
            onClick={() => setShowEntityDiscovery(true)}
            className="flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-medium transition-colors"
          >
            <Search size={12} />
            Find Entities
          </button>
        </div>
        <p className={`text-sm ${themeColors.secondaryText} mb-3`}>
          First, discover your actual Home Assistant entities to ensure automations work correctly.
        </p>
        
        {/* Entity Selection */}
        <div className="space-y-3">
          {/* Motion Sensor Selection */}
          <div>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              Motion Sensor:
            </label>
            <select
              value={selectedMotionEntity}
              onChange={(e) => setSelectedMotionEntity(e.target.value)}
              className={`w-full px-3 py-2 ${themeColors.inputBg} ${themeColors.primaryText} border ${themeColors.inputBorder} rounded text-sm`}
            >
              <option value="">Select motion sensor...</option>
              {entitySuggestions.motion.map(entity => (
                <option key={entity.entity_id} value={entity.entity_id}>
                  {entity.attributes.friendly_name || getFriendlyName(entity.entity_id)} ({entity.entity_id})
                </option>
              ))}
            </select>
          </div>

          {/* Light Selection */}
          <div>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              Light/Switch:
            </label>
            <select
              value={selectedLightEntity}
              onChange={(e) => setSelectedLightEntity(e.target.value)}
              className={`w-full px-3 py-2 ${themeColors.inputBg} ${themeColors.primaryText} border ${themeColors.inputBorder} rounded text-sm`}
            >
              <option value="">Select light or switch...</option>
              {entitySuggestions.lights.map(entity => (
                <option key={entity.entity_id} value={entity.entity_id}>
                  {entity.attributes.friendly_name || getFriendlyName(entity.entity_id)} ({entity.entity_id})
                </option>
              ))}
            </select>
          </div>

          {/* Alarm Selection */}
          <div>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              Alarm Panel (optional):
            </label>
            <select
              value={selectedAlarmEntity}
              onChange={(e) => setSelectedAlarmEntity(e.target.value)}
              className={`w-full px-3 py-2 ${themeColors.inputBg} ${themeColors.primaryText} border ${themeColors.inputBorder} rounded text-sm`}
            >
              <option value="">Select alarm panel...</option>
              {entitySuggestions.alarms.map(entity => (
                <option key={entity.entity_id} value={entity.entity_id}>
                  {entity.attributes.friendly_name || getFriendlyName(entity.entity_id)} ({entity.entity_id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Entity Test Results */}
      {entityTestResults && (
        <div className={`${themeColors.tertiaryBg} p-4 rounded-lg mb-6 text-left`}>
          <h4 className={`font-semibold ${themeColors.whiteText} mb-3`}>Entity Test Results</h4>
          
          {entityTestResults.error ? (
            <div className="text-red-400 text-sm" role="alert">
              Error: {entityTestResults.error}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {/* Motion Sensor Results */}
              {selectedMotionEntity && entityTestResults.motion && (
                <div className="flex items-center justify-between">
                  <span className={themeColors.secondaryText}>Motion Sensor:</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      entityTestResults.motion.status === 'found' ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className={entityTestResults.motion.status === 'found' ? 'text-green-400' : 'text-red-400'}>
                      {entityTestResults.motion.status === 'found' 
                        ? `Found (${entityTestResults.motion.state})`
                        : entityTestResults.motion.error || 'Not found'
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Light Results */}
              {selectedLightEntity && entityTestResults.light && (
                <div className="flex items-center justify-between">
                  <span className={themeColors.secondaryText}>Light Entity:</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      entityTestResults.light.status === 'found' ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className={entityTestResults.light.status === 'found' ? 'text-green-400' : 'text-red-400'}>
                      {entityTestResults.light.status === 'found' 
                        ? `Found (${entityTestResults.light.state})`
                        : entityTestResults.light.error || 'Not found'
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Alarm Results */}
              {selectedAlarmEntity && entityTestResults.alarm && (
                <div className="flex items-center justify-between">
                  <span className={themeColors.secondaryText}>Alarm Panel:</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      entityTestResults.alarm.status === 'found' ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className={entityTestResults.alarm.status === 'found' ? 'text-green-400' : 'text-red-400'}>
                      {entityTestResults.alarm.status === 'found' 
                        ? `Found (${entityTestResults.alarm.state})`
                        : entityTestResults.alarm.error || 'Not found'
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Light Service Results */}
              {entityTestResults.lightService && (
                <div className="flex items-center justify-between">
                  <span className={themeColors.secondaryText}>Light Service:</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      entityTestResults.lightService.status === 'success' ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className={entityTestResults.lightService.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                      {entityTestResults.lightService.status === 'success' 
                        ? 'Working'
                        : entityTestResults.lightService.error || 'Failed'
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-4">
        {/* Test Selected Entities */}
        <button
          onClick={testSelectedEntities}
          disabled={isTestingEntities || (!selectedMotionEntity && !selectedLightEntity && !selectedAlarmEntity)}
          className={`w-full px-4 py-2 ${themeColors.tertiaryBg} ${themeColors.primaryText} hover:${themeColors.hoverBg} rounded-lg font-medium transition-colors border ${themeColors.inputBorder} flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isTestingEntities ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Testing Selected Entities...
            </>
          ) : (
            <>
              <CheckCircle size={16} />
              Test Selected Entities
            </>
          )}
        </button>

        <div className="flex gap-4 justify-center">
          {/* Create Motion Light Automation */}
          <button
            onClick={createMotionLightAutomation}
            disabled={!selectedMotionEntity || !selectedLightEntity || isTestingEntities}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Motion Light
          </button>
          
          {/* Create Alarm Automation */}
          <button
            onClick={createAlarmAutomation}
            disabled={!selectedAlarmEntity || isTestingEntities}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Alarm Auto-Arm
          </button>
          
          {/* Create Custom */}
          <button
            onClick={handleCreateCustom}
            disabled={isTestingEntities}
            className={`px-6 py-3 ${themeColors.tertiaryBg} ${themeColors.primaryText} hover:${themeColors.hoverBg} rounded-lg font-medium transition-colors border ${themeColors.inputBorder} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Create Custom
          </button>
        </div>
      </div>

      {/* Additional Help Text */}
      <div className="mt-6 pt-4 border-t border-gray-600">
        <p className={`text-xs ${themeColors.secondaryText}`}>
          Use "Find Entities" to discover your actual Home Assistant entities, then test them before creating automations.
        </p>
      </div>

      {/* Entity Discovery Modal */}
      {showEntityDiscovery && (
        <EntityDiscovery
          onEntitiesFound={handleEntitiesDiscovered}
          onClose={() => setShowEntityDiscovery(false)}
        />
      )}
    </div>
  );
};

export default QuickSetup;