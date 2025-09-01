// File location: src/AutomationsPage/automations/MotionLightAutomation.js
// Rule #1: When updating a file, if another file is going to be affected, update all affected files.
// Rule #2: File locations and these rules are added to the top of each file.
// Rule #3: Full code is provided for copy and paste.
// Rule #4: A breakdown of tasks is given.
// Rule #5: If a file is not available, a request for it is made.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../ThemeContext.js';
import { Eye, Lightbulb, Clock, Activity, AlertTriangle, Bug } from 'lucide-react';
import AutomationDebugger from '../AutomationDebugger.js';

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

// Motion Light Automation Display Component
const MotionLightAutomation = ({ automation, haStatus, onStatusChange }) => {
  const { themeColors } = useTheme();
  const [motionState, setMotionState] = useState('off');
  const [lightState, setLightState] = useState('off');
  const [countdown, setCountdown] = useState(0);
  const [lastTriggered, setLastTriggered] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [debugMessages, setDebugMessages] = useState([]);
  const [hasError, setHasError] = useState(false);

  // Refs for cleanup and component mounting state
  const isMountedRef = useRef(true);
  const pollIntervalRef = useRef(null);

  // Stable automation properties for dependencies
  const automationIsActive = automation?.is_active;
  const motionEntity = automation?.settings?.motion_entity;
  const lightEntity = automation?.settings?.light_entity;

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
        ...prev.slice(0, 9) // Keep only last 10 messages
      ]);
    }, 100),
    []
  );

  // Enhanced entity state updates with proper error handling
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

      // Create AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        // Get motion sensor state with error handling
        if (motionEntity) {
          try {
            const motionResponse = await fetch(`${finalUrl}/api/states/${motionEntity}`, {
              headers: { 'Authorization': `Bearer ${haToken}` },
              signal: controller.signal
            });
            
            if (motionResponse.ok) {
              const motionData = await motionResponse.json();
              const newMotionState = motionData.state;
              
              if (newMotionState !== motionState) {
                setMotionState(newMotionState);
                addDebugMessage(`Motion sensor: ${motionState} → ${newMotionState}`);
              }
            } else {
              addDebugMessage(`Motion sensor error: ${motionResponse.status}`);
              setHasError(true);
            }
          } catch (motionError) {
            if (motionError.name === 'AbortError') {
              addDebugMessage('Motion sensor timeout');
            } else {
              addDebugMessage(`Motion sensor fetch error: ${motionError.message}`);
            }
            setHasError(true);
          }
        }

        // Get light state with error handling
        if (lightEntity) {
          try {
            const lightResponse = await fetch(`${finalUrl}/api/states/${lightEntity}`, {
              headers: { 'Authorization': `Bearer ${haToken}` },
              signal: controller.signal
            });
            
            if (lightResponse.ok) {
              const lightData = await lightResponse.json();
              const newLightState = lightData.state;
              
              if (newLightState !== lightState) {
                setLightState(newLightState);
                addDebugMessage(`Light: ${lightState} → ${newLightState}`);
              }
            } else {
              addDebugMessage(`Light entity error: ${lightResponse.status}`);
              setHasError(true);
            }
          } catch (lightError) {
            if (lightError.name === 'AbortError') {
              addDebugMessage('Light entity timeout');
            } else {
              addDebugMessage(`Light fetch error: ${lightError.message}`);
            }
            setHasError(true);
          }
        }

        clearTimeout(timeoutId);

        // Reset error state if we got here without errors
        if (isMountedRef.current) {
          setHasError(false);
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
  }, [motionState, lightState, motionEntity, lightEntity, addDebugMessage]);

  // Reduced polling frequency to avoid interference with automation runner - FIXED
  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    if (automationIsActive && haStatus === 'connected' && isMountedRef.current) {
      setIsMonitoring(true);
      
      // Initial state fetch
      updateEntityStates();
      
      // Longer interval for display updates - won't interfere with automation logic
      pollIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          updateEntityStates();
        }
      }, 5000); // Poll every 5 seconds instead of 2
    } else {
      setIsMonitoring(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [automationIsActive, haStatus, updateEntityStates]);

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
      {/* Status Indicators */}
      <div className="grid grid-cols-2 gap-3">
        {/* Motion Status */}
        <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
          <div className="flex items-center gap-2 mb-1">
            <Eye size={14} className={motionState === 'on' ? 'text-red-400' : 'text-gray-400'} />
            <span className={`text-xs font-medium ${themeColors.whiteText}`}>Motion</span>
            {hasError && <AlertTriangle size={12} className="text-red-400" aria-label="Has errors" />}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              motionState === 'on' ? 'bg-red-400 animate-pulse' : 'bg-gray-600'
            }`} aria-label={`Motion sensor: ${motionState}`}></div>
            <span className={`text-sm ${themeColors.primaryText} capitalize`}>{motionState}</span>
          </div>
        </div>

        {/* Light Status */}
        <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb size={14} className={lightState === 'on' ? 'text-yellow-400' : 'text-gray-400'} />
            <span className={`text-xs font-medium ${themeColors.whiteText}`}>Light</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              lightState === 'on' ? 'bg-yellow-400' : 'bg-gray-600'
            }`} aria-label={`Light: ${lightState}`}></div>
            <span className={`text-sm ${themeColors.primaryText} capitalize`}>{lightState}</span>
          </div>
        </div>
      </div>

      {/* Settings Summary */}
      <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={14} className="text-cyan-400" />
          <span className={`text-xs font-medium ${themeColors.whiteText}`}>Configuration</span>
        </div>
        <div className={`text-xs ${themeColors.secondaryText} space-y-1`}>
          <p>Delay: {automation.settings?.delay_seconds || 15} seconds</p>
          <p>Motion: {motionEntity || 'Not configured'}</p>
          <p>Light: {lightEntity || 'Not configured'}</p>
        </div>
      </div>

      {/* Activity Status */}
      <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className={isMonitoring ? 'text-green-400' : 'text-gray-400'} />
          <span className={`text-xs font-medium ${themeColors.whiteText}`}>Activity</span>
        </div>
        <div className={`text-xs ${themeColors.secondaryText}`}>
          <p>Triggered: {automation.trigger_count || 0} times</p>
          <p>Last: {formatLastTriggered(automation.last_triggered)}</p>
          {isMonitoring && (
            <p className="text-green-400">Display monitoring active</p>
          )}
        </div>
      </div>

      {/* Debug Messages for troubleshooting */}
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

// FIXED: Motion Light Automation Runner Class with improved state management and database integration
export class MotionLightAutomationRunner {
  constructor(automation, automationService) {
    this.automation = automation;
    this.automationService = automationService;
    this.isRunning = false;
    this.pollInterval = null;
    this.timeoutId = null;
    this.lastMotionState = null;
    this.lastLightState = 'off';
    this.stateHistory = [];
    this.errorCount = 0;
    this.maxErrors = 10; // Increased max errors before stopping
    this.lastSuccessfulPoll = null;
    this.consecutiveSuccesses = 0;
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.errorCount = 0;
    console.log(`Starting motion light automation: ${this.automation.name}`);

    // More aggressive polling for motion detection (750ms)
    this.pollInterval = setInterval(async () => {
      await this.checkMotionState();
    }, 750);

    // Get initial state
    await this.initializeState();
    
    // Log start event
    await this.automationService.logEvent(
      this.automation.id,
      'started',
      `Motion light automation started`
    );
  }

  // Separate initialization method with better error handling
  async initializeState() {
    try {
      const motionEntity = this.automation.settings.motion_entity;
      if (!motionEntity) {
        throw new Error('Motion entity not configured');
      }

      const motionState = await this.automationService.getHAEntityState(motionEntity);
      this.lastMotionState = motionState.state;
      this.lastSuccessfulPoll = new Date();
      
      console.log(`Initialized motion state: ${this.lastMotionState}`);
      this.addStateHistory(this.lastMotionState, 'initialized');
    } catch (error) {
      console.error('Failed to initialize state:', error);
      this.addStateHistory('error', `initialization_failed: ${error.message}`);
      await this.automationService.logEvent(
        this.automation.id,
        'error',
        `Failed to initialize: ${error.message}`
      );
    }
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    console.log(`Stopped motion light automation: ${this.automation.name}`);
    await this.automationService.logEvent(
      this.automation.id,
      'stopped',
      'Automation stopped'
    );
  }

  // Enhanced state history tracking
  addStateHistory(motionState, action, additionalData = null) {
    const entry = {
      timestamp: new Date(),
      motionState,
      action,
      errorCount: this.errorCount,
      consecutiveSuccesses: this.consecutiveSuccesses,
      additionalData
    };
    
    this.stateHistory.push(entry);
    // Keep only last 50 entries
    if (this.stateHistory.length > 50) {
      this.stateHistory = this.stateHistory.slice(-50);
    }
  }

  async checkMotionState() {
    // Stop if too many consecutive errors
    if (this.errorCount >= this.maxErrors) {
      console.error(`Too many errors (${this.errorCount}), stopping automation`);
      await this.automationService.logEvent(
        this.automation.id,
        'error',
        `Automation stopped due to ${this.errorCount} consecutive errors`
      );
      await this.stop();
      return;
    }

    try {
      const motionEntity = this.automation.settings.motion_entity;
      const lightEntity = this.automation.settings.light_entity;
      const delaySeconds = parseInt(this.automation.settings.delay_seconds) || 15;

      if (!motionEntity || !lightEntity) {
        throw new Error('Motion or light entity not configured');
      }

      // Get current motion state with enhanced error handling
      let motionState;
      try {
        motionState = await this.automationService.getHAEntityState(motionEntity);
        
        // Reset error count on successful state fetch
        this.errorCount = 0;
        this.consecutiveSuccesses++;
        this.lastSuccessfulPoll = new Date();
        
      } catch (entityError) {
        this.errorCount++;
        this.consecutiveSuccesses = 0;
        console.error(`Error getting motion state (${this.errorCount}/${this.maxErrors}):`, entityError);
        
        this.addStateHistory('error', 'motion_state_error', {
          error: entityError.message,
          errorCount: this.errorCount
        });
        
        // Only log to database on first error or every 5th error to avoid spam
        if (this.errorCount === 1 || this.errorCount % 5 === 0) {
          await this.automationService.logEvent(
            this.automation.id,
            'error',
            `Failed to get motion state (${this.errorCount}/${this.maxErrors}): ${entityError.message}`
          );
        }
        return; // Skip this cycle
      }

      const currentMotionState = motionState.state;

      // Handle initial state properly
      if (this.lastMotionState === null) {
        this.lastMotionState = currentMotionState;
        this.addStateHistory(currentMotionState, 'initialized');
        console.log(`Motion state initialized to: ${currentMotionState}`);
        return;
      }

      // Only process actual state changes
      if (this.lastMotionState === currentMotionState) {
        return; // No state change, nothing to do
      }

      console.log(`Motion state change detected: ${this.lastMotionState} → ${currentMotionState}`);

      // Motion detected (off -> on transition)
      if (this.lastMotionState === 'off' && currentMotionState === 'on') {
        console.log(`Motion detected by ${motionEntity}`);
        this.addStateHistory(currentMotionState, 'motion_detected');
        
        // Cancel any pending light turn-off
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
          console.log('Cancelled pending light turn-off due to new motion');
          this.addStateHistory(currentMotionState, 'countdown_cancelled');
        }

        // Turn on the light with robust error handling
        try {
          console.log(`Attempting to turn on ${lightEntity}`);
          
          await this.automationService.callHAService('turn_on', 'light', lightEntity, {
            entity_id: lightEntity
          });
          
          console.log(`Successfully turned on ${lightEntity}`);
          this.addStateHistory(currentMotionState, 'light_turned_on');
          
          await this.automationService.logEvent(
            this.automation.id, 
            'triggered', 
            `Motion detected - turned on ${lightEntity}`
          );
        } catch (lightError) {
          console.error(`Failed to turn on light ${lightEntity}:`, lightError);
          this.addStateHistory(currentMotionState, 'light_error', { error: lightError.message });
          
          await this.automationService.logEvent(
            this.automation.id,
            'error',
            `Failed to turn on light: ${lightError.message}`
          );
        }
        
        // Update trigger count
        await this.automationService.updateAutomationTriggerCount(this.automation.id);
      }

      // Motion stopped (on -> off transition)
      else if (this.lastMotionState === 'on' && currentMotionState === 'off') {
        console.log(`Motion stopped by ${motionEntity}, starting ${delaySeconds}s countdown`);
        this.addStateHistory(currentMotionState, 'countdown_started', { delay: delaySeconds });
        
        // Start countdown to turn off light
        this.timeoutId = setTimeout(async () => {
          try {
            // CRITICAL: Double-check motion state before turning off
            const finalMotionCheck = await this.automationService.getHAEntityState(motionEntity);
            
            if (finalMotionCheck.state === 'off') {
              // Motion is still off, turn off the light
              try {
                console.log(`Countdown finished - turning off ${lightEntity}`);
                
                await this.automationService.callHAService('turn_off', 'light', lightEntity, {
                  entity_id: lightEntity
                });
                
                console.log(`Successfully turned off ${lightEntity}`);
                this.addStateHistory('off', 'light_turned_off');
                
                await this.automationService.logEvent(
                  this.automation.id,
                  'action_executed',
                  `No motion for ${delaySeconds}s - turned off ${lightEntity}`
                );
              } catch (lightError) {
                console.error(`Failed to turn off light ${lightEntity}:`, lightError);
                this.addStateHistory('off', 'light_error', { error: lightError.message });
                
                await this.automationService.logEvent(
                  this.automation.id,
                  'error',
                  `Failed to turn off light: ${lightError.message}`
                );
              }
            } else {
              console.log('Motion detected during countdown - keeping light on');
              this.addStateHistory(finalMotionCheck.state, 'countdown_cancelled');
              
              await this.automationService.logEvent(
                this.automation.id,
                'triggered',
                'Motion detected during countdown - cancelled turn-off'
              );
              
              // Update our state to reflect the current motion
              this.lastMotionState = finalMotionCheck.state;
            }
          } catch (error) {
            console.error('Error in motion light timeout:', error);
            this.addStateHistory('unknown', 'timeout_error', { error: error.message });
            
            await this.automationService.logEvent(
              this.automation.id,
              'error',
              `Error during timeout: ${error.message}`
            );
          }
          this.timeoutId = null;
        }, delaySeconds * 1000);

        await this.automationService.logEvent(
          this.automation.id,
          'triggered',
          `Motion stopped - starting ${delaySeconds}s countdown`
        );
      }

      // Update state
      this.lastMotionState = currentMotionState;
      
    } catch (error) {
      this.errorCount++;
      this.consecutiveSuccesses = 0;
      console.error(`General error in motion state check (${this.errorCount}/${this.maxErrors}):`, error);
      this.addStateHistory('error', 'general_error', { error: error.message });
      
      await this.automationService.logEvent(
        this.automation.id,
        'error',
        `Error checking motion state: ${error.message}`
      );
    }
  }

  // Enhanced debug method to get current state
  getDebugInfo() {
    return {
      isRunning: this.isRunning,
      lastMotionState: this.lastMotionState,
      hasTimeout: this.timeoutId !== null,
      errorCount: this.errorCount,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastSuccessfulPoll: this.lastSuccessfulPoll,
      stateHistory: this.stateHistory.slice(-10), // Last 10 entries
      pollIntervalActive: this.pollInterval !== null,
      automationId: this.automation.id,
      automationName: this.automation.name
    };
  }
}

export default MotionLightAutomation;