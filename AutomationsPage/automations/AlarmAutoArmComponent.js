// File location: src/AutomationsPage/automations/AlarmAutoArmComponent.js
// Rule #1: When updating a file, if another file is going to be affected, update all affected files.
// Rule #2: File locations and these rules are added to the top of each file.
// Rule #3: Full code is provided for copy and paste.
// Rule #4: A breakdown of tasks is given.
// Rule #5: If a file is not available, a request for it is made.

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../ThemeContext.js';
import { Shield, Clock, CheckCircle, AlertTriangle, Bug, Activity, Eye, RefreshCw, Play, Database, Trash2 } from 'lucide-react';
import AutomationDebugger from '../AutomationDebugger.js';

// Alarm Auto-Arm Automation Display Component
const AlarmAutoArmComponent = ({ automation, haStatus, onStatusChange }) => {
  const { themeColors } = useTheme();
  const [alarmState, setAlarmState] = useState('unknown');
  const [isInActiveWindow, setIsInActiveWindow] = useState(false);
  const [nextArmTime, setNextArmTime] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [debugMessages, setDebugMessages] = useState([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [automationLogs, setAutomationLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Check time window (9pm to 7am)
  const isInArmingWindow = () => {
    const now = new Date();
    const hour = now.getHours();
    // 21:00 (9pm) to 07:00 (7am) - spans midnight
    return hour >= 21 || hour < 7;
  };

  // Get next arming time
  const getNextArmTime = () => {
    const now = new Date();
    const today9pm = new Date(now);
    today9pm.setHours(21, 0, 0, 0);
    
    if (now < today9pm) {
      return today9pm; // Today at 9pm
    } else {
      const tomorrow9pm = new Date(today9pm);
      tomorrow9pm.setDate(tomorrow9pm.getDate() + 1);
      return tomorrow9pm; // Tomorrow at 9pm
    }
  };

  // Monitor alarm state and time windows
  useEffect(() => {
    let monitorInterval;
    
    if (automation.is_active && haStatus === 'connected') {
      setIsMonitoring(true);
      
      // Check every minute for precise timing
      monitorInterval = setInterval(async () => {
        await checkAlarmState();
        updateTimeWindow();
      }, 60000);

      // Initial checks
      checkAlarmState();
      updateTimeWindow();
    } else {
      setIsMonitoring(false);
    }

    return () => {
      if (monitorInterval) clearInterval(monitorInterval);
    };
  }, [automation.is_active, haStatus]);

  // Load automation logs from database
  useEffect(() => {
    if (automation && automation.id) {
      loadAutomationLogs();
    }
  }, [automation]);

  const updateTimeWindow = () => {
    const inWindow = isInArmingWindow();
    setIsInActiveWindow(inWindow);
    setNextArmTime(getNextArmTime());
  };

  const addDebugMessage = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugMessages(prev => [
      { time: timestamp, message },
      ...prev.slice(0, 49) // Keep only last 50 messages
    ]);
  };

  const loadAutomationLogs = async () => {
    if (!automation || !automation.id) return;
    
    setIsLoadingLogs(true);
    try {
      // Import AutomationService to get logs
      const { default: AutomationService } = await import('../../services/AutomationService.js');
      const logs = await AutomationService.getAutomationLogs(automation.id, 50);
      setAutomationLogs(logs);
      addDebugMessage(`Loaded ${logs.length} automation logs from database`);
    } catch (error) {
      console.error('Failed to load automation logs:', error);
      addDebugMessage(`Failed to load logs: ${error.message}`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const checkAlarmState = async () => {
    try {
      const haUrl = localStorage.getItem('ha_url');
      const haToken = localStorage.getItem('ha_token');
      
      if (!haUrl || !haToken) {
        addDebugMessage('No HA credentials found');
        return;
      }

      const normalizedUrl = haUrl.replace(/\/$/, '');
      const finalUrl = !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://') 
        ? 'http://' + normalizedUrl 
        : normalizedUrl;

      const response = await fetch(`${finalUrl}/api/states/alarm_control_panel.home_alarm`, {
        headers: { 'Authorization': `Bearer ${haToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const newAlarmState = data.state;
        const previousState = alarmState;
        
        if (previousState !== 'unknown' && previousState !== newAlarmState) {
          addDebugMessage(`Alarm: ${previousState} → ${newAlarmState}`);
        }
        
        setAlarmState(newAlarmState);
        setLastCheck(new Date());
        
        // Auto-arm logic: only arm if in window, not already armed, and not pending
        if (isInArmingWindow() && newAlarmState === 'disarmed') {
          await attemptAutoArm();
        }
        
      } else {
        addDebugMessage(`Alarm state error: ${response.status}`);
        setAlarmState('error');
      }
    } catch (error) {
      console.error('Failed to check alarm state:', error);
      addDebugMessage(`Check error: ${error.message}`);
      setAlarmState('error');
    }
  };

  const attemptAutoArm = async () => {
    try {
      addDebugMessage('Attempting to auto-arm alarm...');
      
      const haUrl = localStorage.getItem('ha_url');
      const haToken = localStorage.getItem('ha_token');
      
      const normalizedUrl = haUrl.replace(/\/$/, '');
      const finalUrl = !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://') 
        ? 'http://' + normalizedUrl 
        : normalizedUrl;

      const response = await fetch(`${finalUrl}/api/services/alarm_control_panel/alarm_arm_away`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${haToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: 'alarm_control_panel.home_alarm'
        }),
      });

      if (response.ok) {
        addDebugMessage('Auto-arm command sent successfully');
        
        // Wait a moment then check state again
        setTimeout(() => {
          checkAlarmState();
        }, 2000);
      } else {
        const errorText = await response.text();
        addDebugMessage(`Auto-arm failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      addDebugMessage(`Auto-arm error: ${error.message}`);
    }
  };

  const runDiagnosticTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    
    const tests = [];

    // Test 1: Time Window Check
    tests.push({ id: 'time_window', name: 'Time Window Check', status: 'running', message: 'Testing...' });
    setTestResults([...tests]);
    
    try {
      const now = new Date();
      const hour = now.getHours();
      const inWindow = hour >= 21 || hour < 7;
      
      tests[tests.length - 1] = {
        id: 'time_window',
        name: 'Time Window Check',
        status: inWindow ? 'passed' : 'info',
        message: `Current: ${now.toLocaleTimeString()} (${inWindow ? 'IN WINDOW' : 'outside window'})`
      };
      setTestResults([...tests]);
    } catch (error) {
      tests[tests.length - 1] = {
        id: 'time_window',
        name: 'Time Window Check',
        status: 'failed',
        message: error.message
      };
      setTestResults([...tests]);
    }

    // Test 2: Alarm Entity State
    tests.push({ id: 'alarm_entity', name: 'Alarm Entity', status: 'running', message: 'Testing...' });
    setTestResults([...tests]);
    
    try {
      const haUrl = localStorage.getItem('ha_url');
      const haToken = localStorage.getItem('ha_token');
      
      if (!haUrl || !haToken) {
        tests[tests.length - 1] = {
          id: 'alarm_entity',
          name: 'Alarm Entity',
          status: 'failed',
          message: 'No HA credentials found'
        };
        setTestResults([...tests]);
      } else {
        const normalizedUrl = haUrl.replace(/\/$/, '');
        const finalUrl = !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://') 
          ? 'http://' + normalizedUrl 
          : normalizedUrl;

        const response = await fetch(`${finalUrl}/api/states/alarm_control_panel.home_alarm`, {
          headers: { 'Authorization': `Bearer ${haToken}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          tests[tests.length - 1] = {
            id: 'alarm_entity',
            name: 'Alarm Entity',
            status: 'passed',
            message: `State: ${data.state}, Available: ${data.attributes.supported_features || 'unknown'}`
          };
          setTestResults([...tests]);
        } else {
          tests[tests.length - 1] = {
            id: 'alarm_entity',
            name: 'Alarm Entity',
            status: 'failed',
            message: `HTTP ${response.status}: ${response.statusText}`
          };
          setTestResults([...tests]);
        }
      }
    } catch (error) {
      tests[tests.length - 1] = {
        id: 'alarm_entity',
        name: 'Alarm Entity',
        status: 'failed',
        message: error.message
      };
      setTestResults([...tests]);
    }

    // Test 3: Service Availability
    tests.push({ id: 'service_test', name: 'Service Test', status: 'running', message: 'Testing...' });
    setTestResults([...tests]);
    
    try {
      const haUrl = localStorage.getItem('ha_url');
      const haToken = localStorage.getItem('ha_token');
      
      const normalizedUrl = haUrl.replace(/\/$/, '');
      const finalUrl = !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://') 
        ? 'http://' + normalizedUrl 
        : normalizedUrl;

      // Just check if service endpoint exists (don't actually call it)
      const response = await fetch(`${finalUrl}/api/services/alarm_control_panel`, {
        headers: { 'Authorization': `Bearer ${haToken}` }
      });
      
      if (response.ok) {
        const services = await response.json();
        const hasArmAway = services.some(s => s.service === 'alarm_arm_away');
        const hasArmHome = services.some(s => s.service === 'alarm_arm_home');
        
        tests[tests.length - 1] = {
          id: 'service_test',
          name: 'Service Test',
          status: 'passed',
          message: `Available: arm_away(${hasArmAway}), arm_home(${hasArmHome})`
        };
      } else {
        tests[tests.length - 1] = {
          id: 'service_test',
          name: 'Service Test',
          status: 'failed',
          message: `Cannot access services: ${response.status}`
        };
      }
      setTestResults([...tests]);
    } catch (error) {
      tests[tests.length - 1] = {
        id: 'service_test',
        name: 'Service Test',
        status: 'failed',
        message: error.message
      };
      setTestResults([...tests]);
    }

    // Test 4: Manual Arm Test (only if alarm is disarmed)
    if (alarmState === 'disarmed') {
      tests.push({ id: 'manual_arm', name: 'Manual Arm Test', status: 'running', message: 'Testing...' });
      setTestResults([...tests]);
      
      try {
        const result = await attemptManualArm();
        tests[tests.length - 1] = {
          id: 'manual_arm',
          name: 'Manual Arm Test',
          status: result.success ? 'passed' : 'failed',
          message: result.message
        };
      } catch (error) {
        tests[tests.length - 1] = {
          id: 'manual_arm',
          name: 'Manual Arm Test',
          status: 'failed',
          message: error.message
        };
      }
      setTestResults([...tests]);
    }

    setIsRunningTests(false);
    addDebugMessage('Diagnostic tests completed');
  };

  const attemptManualArm = async () => {
    try {
      addDebugMessage('Manual arm test: Sending arm command...');
      
      const haUrl = localStorage.getItem('ha_url');
      const haToken = localStorage.getItem('ha_token');
      const normalizedUrl = haUrl.replace(/\/$/, '');
      const finalUrl = !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://') 
        ? 'http://' + normalizedUrl 
        : normalizedUrl;

      const response = await fetch(`${finalUrl}/api/services/alarm_control_panel/alarm_arm_away`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${haToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: 'alarm_control_panel.home_alarm'
        }),
      });

      if (response.ok) {
        addDebugMessage('Manual arm test: Command sent successfully');
        
        // Wait and check result
        await new Promise(resolve => setTimeout(resolve, 3000));
        const checkResponse = await fetch(`${finalUrl}/api/states/alarm_control_panel.home_alarm`, {
          headers: { 'Authorization': `Bearer ${haToken}` }
        });
        
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          addDebugMessage(`Manual arm test: Result state is ${checkData.state}`);
          return {
            success: checkData.state !== 'disarmed',
            message: `Command sent, result: ${checkData.state}`
          };
        } else {
          return {
            success: true,
            message: 'Command sent, could not verify result'
          };
        }
      } else {
        const errorText = await response.text();
        addDebugMessage(`Manual arm test failed: ${response.status} ${errorText}`);
        return {
          success: false,
          message: `HTTP ${response.status}: ${errorText}`
        };
      }
    } catch (error) {
      addDebugMessage(`Manual arm test error: ${error.message}`);
      return {
        success: false,
        message: error.message
      };
    }
  };

  const clearAllLogs = () => {
    setDebugMessages([]);
    setTestResults([]);
    setAutomationLogs([]);
    addDebugMessage('All logs cleared');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <div className="w-2 h-2 bg-green-500 rounded-full"></div>;
      case 'failed':
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
      case 'running':
        return <RefreshCw size={12} className="text-yellow-500 animate-spin" />;
      case 'info':
        return <div className="w-2 h-2 bg-blue-500 rounded-full"></div>;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full"></div>;
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
      case 'info':
        return 'text-blue-400';
      default:
        return themeColors.secondaryText;
    }
  };

  const getAlarmStateIcon = (state) => {
    switch (state) {
      case 'armed_away':
        return <Shield size={16} className="text-green-400" />;
      case 'disarmed':
        return <Shield size={16} className="text-red-400" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-400 animate-pulse" />;
      case 'triggered':
        return <AlertTriangle size={16} className="text-red-500 animate-pulse" />;
      case 'error':
        return <AlertTriangle size={16} className="text-red-400" />;
      default:
        return <Shield size={16} className="text-gray-400" />;
    }
  };

  const getAlarmStateText = (state) => {
    switch (state) {
      case 'armed_away':
        return 'Armed Away';
      case 'armed_home':
        return 'Armed Home';
      case 'disarmed':
        return 'Disarmed';
      case 'pending':
        return 'Pending';
      case 'triggered':
        return 'TRIGGERED';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getAlarmStateColor = (state) => {
    switch (state) {
      case 'armed_away':
      case 'armed_home':
        return 'text-green-400';
      case 'disarmed':
        return 'text-red-400';
      case 'pending':
        return 'text-yellow-400';
      case 'triggered':
        return 'text-red-500';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatTime = (date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString();
  };

  const getTimeUntilNext = () => {
    if (!nextArmTime) return '';
    
    const now = new Date();
    const diffMs = nextArmTime - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`;
    }
    return `${diffMins}m`;
  };

  return (
    <div className="space-y-3">
      {/* Alarm Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
          <div className="flex items-center gap-2 mb-1">
            {getAlarmStateIcon(alarmState)}
            <span className={`text-xs font-medium ${themeColors.whiteText}`}>Alarm State</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getAlarmStateColor(alarmState)}`}>
              {getAlarmStateText(alarmState)}
            </span>
          </div>
        </div>

        <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className={isInActiveWindow ? 'text-green-400' : 'text-gray-400'} />
            <span className={`text-xs font-medium ${themeColors.whiteText}`}>Time Window</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isInActiveWindow ? 'bg-green-400' : 'bg-gray-600'
            }`}></div>
            <span className={`text-sm ${themeColors.primaryText}`}>
              {isInActiveWindow ? 'Active (9PM-7AM)' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Schedule Information */}
      <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={14} className="text-cyan-400" />
          <span className={`text-xs font-medium ${themeColors.whiteText}`}>Auto-Arm Schedule</span>
        </div>
        <div className={`text-xs ${themeColors.secondaryText} space-y-1`}>
          <p>Active: 9:00 PM to 7:00 AM daily</p>
          <p>Entity: alarm_control_panel.home_alarm</p>
          {!isInActiveWindow && nextArmTime && (
            <p>Next activation: {formatTime(nextArmTime)} (in {getTimeUntilNext()})</p>
          )}
        </div>
      </div>

      {/* Logic Status */}
      <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className={isMonitoring ? 'text-green-400' : 'text-gray-400'} />
          <span className={`text-xs font-medium ${themeColors.whiteText}`}>Automation Logic</span>
        </div>
        <div className={`text-xs ${themeColors.secondaryText} space-y-1`}>
          <p>
            Status: {
              !isInActiveWindow ? 'Waiting for 9PM' :
              alarmState === 'armed_away' ? 'Armed - No action needed' :
              alarmState === 'disarmed' ? 'Will auto-arm when disarmed' :
              alarmState === 'pending' ? 'Pending - Monitoring' :
              'Monitoring'
            }
          </p>
          <p>Last check: {formatTime(lastCheck)}</p>
          {isMonitoring && (
            <p className="text-green-400">Monitoring every minute</p>
          )}
        </div>
      </div>

      {/* Debug & Monitoring Section */}
      <div className={`p-4 ${themeColors.tertiaryBg} rounded-lg`}>
        {/* Header with control buttons */}
        <div className="flex justify-between items-center mb-4">
          <h5 className={`text-sm font-medium ${themeColors.whiteText} flex items-center gap-2`}>
            <Bug size={16} className="text-purple-400" />
            Debug & Monitoring
          </h5>
          <div className="flex gap-2">
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              disabled={haStatus !== 'connected'}
              className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                isMonitoring 
                  ? 'bg-green-600 text-white' 
                  : `${themeColors.secondaryBg} ${themeColors.primaryText} hover:bg-green-600 hover:text-white`
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Activity size={12} />
              {isMonitoring ? 'Stop Monitor' : 'Start Monitor'}
            </button>
            
            <button
              onClick={runDiagnosticTests}
              disabled={isRunningTests || haStatus !== 'connected'}
              className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${themeColors.secondaryBg} ${themeColors.primaryText} hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRunningTests ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
              {isRunningTests ? 'Testing...' : 'Run Tests'}
            </button>
            
            <button
              onClick={loadAutomationLogs}
              disabled={isLoadingLogs}
              className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${themeColors.secondaryBg} ${themeColors.primaryText} hover:bg-purple-600 hover:text-white transition-colors disabled:opacity-50`}
            >
              {isLoadingLogs ? <RefreshCw size={12} className="animate-spin" /> : <Database size={12} />}
              {isLoadingLogs ? 'Loading...' : 'Refresh Logs'}
            </button>

            <button
              onClick={clearAllLogs}
              className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors`}
            >
              <Trash2 size={12} />
              Clear Logs
            </button>
          </div>
        </div>

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

        {/* Debug Messages */}
        {debugMessages.length > 0 && (
          <div className="mb-4">
            <h6 className={`text-xs font-medium ${themeColors.whiteText} mb-2`}>
              Debug Messages ({debugMessages.length})
            </h6>
            <div className={`${themeColors.secondaryBg} rounded p-2 max-h-40 overflow-y-auto`}>
              <div className="space-y-1">
                {debugMessages.slice(-20).map((entry, index) => (
                  <div key={index} className="flex justify-between items-start text-xs">
                    <span className={`text-cyan-400`}>{entry.message}</span>
                    <span className={`${themeColors.secondaryText} text-xs flex-shrink-0 ml-2`}>
                      {entry.time}
                    </span>
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
            <div className={`${themeColors.secondaryBg} rounded p-2 max-h-48 overflow-y-auto`}>
              <div className="space-y-1">
                {automationLogs.slice(0, 20).map((log, index) => (
                  <div key={index} className="text-xs border-b border-gray-700 pb-1 mb-1 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <span className={`font-medium capitalize ${
                        log.event_type === 'error' ? 'text-red-400' :
                        log.event_type === 'triggered' ? 'text-green-400' :
                        log.event_type === 'started' ? 'text-blue-400' :
                        log.event_type === 'stopped' ? 'text-orange-400' :
                        log.event_type === 'action_executed' ? 'text-purple-400' :
                        themeColors.whiteText
                      }`}>
                        {log.event_type}
                      </span>
                      <span className={`${themeColors.secondaryText} text-xs flex-shrink-0`}>
                        {new Date(log.created_at).toLocaleTimeString()}
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

        {/* Current Status Summary */}
        <div className={`${themeColors.secondaryBg} p-3 rounded-lg`}>
          <h6 className={`text-xs font-medium ${themeColors.whiteText} mb-2`}>Current Status</h6>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className={`${themeColors.secondaryText}`}>Monitoring:</span>
              <span className={`ml-2 ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`}>
                {isMonitoring ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div>
              <span className={`${themeColors.secondaryText}`}>Alarm State:</span>
              <span className={`ml-2 ${getAlarmStateColor(alarmState)} font-medium`}>
                {getAlarmStateText(alarmState)}
              </span>
            </div>
            <div>
              <span className={`${themeColors.secondaryText}`}>Time Window:</span>
              <span className={`ml-2 ${isInActiveWindow ? 'text-green-400' : 'text-gray-400'}`}>
                {isInActiveWindow ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div>
              <span className={`${themeColors.secondaryText}`}>Last Check:</span>
              <span className={`ml-2 ${themeColors.whiteText}`}>
                {formatTime(lastCheck)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Warning */}
      {haStatus !== 'connected' && (
        <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-yellow-400" />
            <span className="text-xs text-yellow-400">Debug tools require Home Assistant connection</span>
          </div>
        </div>
      )}

      {/* Debug Component */}
      <AutomationDebugger automation={automation} haStatus={haStatus} />
    </div>
  );
};

// Alarm Auto-Arm Automation Runner Class - FIXED VERSION
export class AlarmAutoArmRunner {
  constructor(automation, automationService) {
    this.automation = automation;
    this.automationService = automationService;
    this.isRunning = false;
    this.checkInterval = null;
    this.lastAlarmState = null;
    this.stateHistory = [];
    this.errorCount = 0;
    this.maxErrors = 10;
    this.lastArmAttempt = null;
    this.armCooldown = 5 * 60 * 1000; // 5 minutes between arm attempts
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.errorCount = 0;
    console.log(`Starting alarm auto-arm automation: ${this.automation.name}`);

    // Check every 30 seconds for more responsive operation
    this.checkInterval = setInterval(async () => {
      await this.checkAndArm();
    }, 30000);

    // Initial check immediately
    await this.initializeState();
    await this.checkAndArm();
    
    await this.automationService.logEvent(
      this.automation.id,
      'started',
      'Alarm auto-arm automation started - checking every 30 seconds'
    );
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    console.log(`Stopped alarm auto-arm automation: ${this.automation.name}`);
    await this.automationService.logEvent(
      this.automation.id,
      'stopped',
      'Alarm auto-arm automation stopped'
    );
  }

  async initializeState() {
    try {
      const alarmState = await this.automationService.getHAEntityState('alarm_control_panel.home_alarm');
      this.lastAlarmState = alarmState.state;
      
      console.log(`Initialized alarm state: ${this.lastAlarmState}`);
      this.addStateHistory('initialized', `Initial state: ${this.lastAlarmState}`, {
        inWindow: this.isInArmingWindow(),
        currentTime: new Date().toLocaleTimeString()
      });
    } catch (error) {
      console.error('Failed to initialize alarm state:', error);
      this.addStateHistory('error', `Initialization failed: ${error.message}`);
      
      await this.automationService.logEvent(
        this.automation.id,
        'error',
        `Failed to initialize alarm state: ${error.message}`
      );
    }
  }

  isInArmingWindow() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute; // Convert to minutes since midnight
    
    const armStart = 21 * 60; // 9 PM in minutes (1260)
    const armEnd = 7 * 60;    // 7 AM in minutes (420)
    
    // Handle time window that spans midnight
    if (armStart > armEnd) {
      // Evening (21:00-23:59) OR early morning (00:00-06:59)
      return currentTime >= armStart || currentTime < armEnd;
    } else {
      // Normal time window (shouldn't happen with 21:00-07:00 but handle it)
      return currentTime >= armStart && currentTime < armEnd;
    }
  }

  async checkAndArm() {
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
      const now = new Date();
      const inWindow = this.isInArmingWindow();
      
      console.log(`[${now.toLocaleTimeString()}] === ALARM CHECK ===`);
      console.log(`Current time: ${now.toLocaleTimeString()} (Hour: ${now.getHours()})`);
      console.log(`In arming window (21:00-07:00): ${inWindow}`);
      
      // Get current alarm state with detailed logging
      let alarmStateResponse;
      let currentState;
      
      try {
        console.log('Fetching alarm state from: alarm_control_panel.home_alarm');
        alarmStateResponse = await this.automationService.getHAEntityState('alarm_control_panel.home_alarm');
        currentState = alarmStateResponse.state;
        console.log(`Alarm state fetched successfully: ${currentState}`);
        console.log('Full alarm entity data:', JSON.stringify(alarmStateResponse, null, 2));
      } catch (entityError) {
        this.errorCount++;
        console.error(`Failed to get alarm state (${this.errorCount}/${this.maxErrors}):`, entityError);
        this.addStateHistory('fetch_error', `Failed to get alarm state: ${entityError.message}`, {
          errorCount: this.errorCount,
          time: now.toLocaleTimeString()
        });
        
        await this.automationService.logEvent(
          this.automation.id,
          'error',
          `Failed to get alarm state: ${entityError.message}`
        );
        return;
      }
      
      // Reset error count on successful fetch
      this.errorCount = 0;
      
      // Log state changes
      if (this.lastAlarmState !== null && this.lastAlarmState !== currentState) {
        console.log(`📊 ALARM STATE CHANGE: ${this.lastAlarmState} → ${currentState}`);
        this.addStateHistory('state_change', `${this.lastAlarmState} → ${currentState}`, {
          inWindow,
          time: now.toLocaleTimeString()
        });
        
        await this.automationService.logEvent(
          this.automation.id,
          'triggered',
          `Alarm state changed: ${this.lastAlarmState} → ${currentState} (Window: ${inWindow ? 'Active' : 'Inactive'})`
        );
      }
      
      this.lastAlarmState = currentState;
      
      // Detailed condition checking
      console.log('=== CONDITION CHECK ===');
      console.log(`✓ Time window check: ${inWindow} (need: true)`);
      console.log(`✓ Alarm state check: ${currentState} (need: disarmed)`);
      
      const shouldAttemptArm = inWindow && currentState === 'disarmed';
      console.log(`✓ Should attempt arm: ${shouldAttemptArm}`);
      
      // Check cooldown
      if (shouldAttemptArm && this.lastArmAttempt) {
        const timeSinceLastAttempt = now - this.lastArmAttempt;
        const cooldownRemaining = this.armCooldown - timeSinceLastAttempt;
        
        if (cooldownRemaining > 0) {
          const remainingMinutes = Math.ceil(cooldownRemaining / 1000 / 60);
          console.log(`⏰ COOLDOWN ACTIVE: ${remainingMinutes}m remaining`);
          this.addStateHistory('cooldown', `Waiting ${remainingMinutes}m before next arm attempt`);
          return;
        }
      }
      
      // Main arming logic
      if (shouldAttemptArm) {
        console.log(`🔒 CONDITIONS MET - ATTEMPTING TO ARM`);
        console.log(`  Time: ${now.toLocaleTimeString()}`);
        console.log(`  Window Active: ${inWindow}`);
        console.log(`  Alarm State: ${currentState}`);
        
        await this.armAlarmWithValidation();
        this.lastArmAttempt = now;
        
      } else {
        // Log why we're not arming
        let reasons = [];
        if (!inWindow) {
          reasons.push(`outside time window (current: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}, need: 21:00-07:00)`);
        }
        if (currentState !== 'disarmed') {
          reasons.push(`alarm is ${currentState} (need: disarmed)`);
        }
        
        const reasonText = reasons.join(' and ');
        console.log(`❌ NOT ARMING: ${reasonText}`);
        
        this.addStateHistory('no_action', `Not arming: ${reasonText}`, {
          inWindow,
          alarmState: currentState,
          time: now.toLocaleTimeString(),
          hour: now.getHours()
        });
      }
      
      // Update trigger count for activity tracking
      await this.automationService.updateAutomationTriggerCount(this.automation.id);
      
    } catch (error) {
      this.errorCount++;
      console.error(`💥 GENERAL ERROR in alarm check (${this.errorCount}/${this.maxErrors}):`, error);
      this.addStateHistory('error', error.message, {
        errorCount: this.errorCount,
        time: new Date().toLocaleTimeString()
      });
      
      if (this.errorCount === 1 || this.errorCount % 3 === 0) {
        await this.automationService.logEvent(
          this.automation.id,
          'error',
          `Failed to check alarm state (${this.errorCount}/${this.maxErrors}): ${error.message}`
        );
      }
    }
  }

  async armAlarmWithValidation() {
    try {
      console.log('🔒 STEP 1: Pre-arm validation');
      
      // Double-check alarm state before arming
      const preArmState = await this.automationService.getHAEntityState('alarm_control_panel.home_alarm');
      console.log(`Pre-arm alarm state: ${preArmState.state}`);
      
      if (preArmState.state !== 'disarmed') {
        console.log(`⚠️  ABORTING ARM: Alarm changed to ${preArmState.state} during check`);
        this.addStateHistory('abort_arm', `Alarm changed to ${preArmState.state} before arming`);
        return;
      }
      
      console.log('🔒 STEP 2: Sending arm command');
      this.addStateHistory('arming', 'Sending alarm_arm_away command', {
        time: new Date().toLocaleTimeString(),
        preArmState: preArmState.state
      });
      
      // Try the service call with enhanced error handling
      try {
        await this.automationService.callHAService(
          'alarm_arm_away', 
          'alarm_control_panel', 
          'alarm_control_panel.home_alarm',
          { 
            entity_id: 'alarm_control_panel.home_alarm'
          }
        );
        
        console.log('✅ STEP 3: Arm command sent successfully');
        
      } catch (serviceError) {
        console.error('💥 SERVICE CALL FAILED:', serviceError);
        
        // Check if it's a 500 error - might be HA configuration issue
        if (serviceError.message.includes('500')) {
          console.log('🔍 HTTP 500 Error - Checking alarm panel configuration...');
          
          // Get more details about the alarm entity
          try {
            const alarmDetails = await this.automationService.getHAEntityState('alarm_control_panel.home_alarm');
            console.log('Alarm entity details:', JSON.stringify(alarmDetails.attributes, null, 2));
            
            this.addStateHistory('service_error', `HTTP 500 - Check alarm panel config. Current attrs: ${JSON.stringify(alarmDetails.attributes)}`, {
              time: new Date().toLocaleTimeString(),
              fullError: serviceError.message
            });
          } catch (detailError) {
            console.error('Could not get alarm details:', detailError);
          }
          
          // Suggest alternative service calls
          console.log('🔄 Trying alternative service calls...');
          
          // Try arm_home instead
          try {
            console.log('Trying alarm_arm_home service...');
            await this.automationService.callHAService(
              'alarm_arm_home', 
              'alarm_control_panel', 
              'alarm_control_panel.home_alarm',
              { entity_id: 'alarm_control_panel.home_alarm' }
            );
            console.log('✅ arm_home succeeded as fallback');
            this.addStateHistory('fallback_arm', 'Used alarm_arm_home as fallback');
          } catch (fallbackError) {
            console.error('❌ Fallback arm_home also failed:', fallbackError);
            throw serviceError; // Throw original error
          }
          
        } else {
          throw serviceError;
        }
      }
      
      this.addStateHistory('armed', 'Arm command completed', {
        time: new Date().toLocaleTimeString()
      });
      
      await this.automationService.logEvent(
        this.automation.id,
        'action_executed',
        `Auto-armed alarm during night hours (${new Date().toLocaleTimeString()})`
      );
      
      // STEP 4: Verify the arming worked
      console.log('🔒 STEP 4: Verifying arm status (waiting 5 seconds)');
      setTimeout(async () => {
        await this.verifyArmStatus();
      }, 5000);
      
    } catch (error) {
      console.error('💥 FAILED TO ARM ALARM:', error);
      
      let errorDetails = error.message;
      if (error.message.includes('500')) {
        errorDetails += ' - This usually means the alarm panel rejected the command. Check: 1) Alarm is properly configured, 2) All sensors are closed, 3) Alarm panel is ready to arm';
      }
      
      this.addStateHistory('arm_error', `Failed to arm: ${errorDetails}`, {
        time: new Date().toLocaleTimeString(),
        errorType: error.name
      });
      
      await this.automationService.logEvent(
        this.automation.id,
        'error',
        `Failed to arm alarm: ${errorDetails}`
      );
    }
  }

  async verifyArmStatus() {
    try {
      const postArmState = await this.automationService.getHAEntityState('alarm_control_panel.home_alarm');
      const newState = postArmState.state;
      
      console.log(`🔍 POST-ARM VERIFICATION: alarm is now ${newState}`);
      
      if (newState === 'armed_away' || newState === 'armed_home') {
        console.log('✅ ARM SUCCESSFUL - Alarm is now armed');
        this.addStateHistory('verify_success', `Verification: alarm successfully armed (${newState})`);
      } else if (newState === 'pending') {
        console.log('⏳ ARM PENDING - Alarm is in pending state (normal for exit delay)');
        this.addStateHistory('verify_pending', 'Verification: alarm in pending state (exit delay)');
      } else {
        console.log(`⚠️  ARM ISSUE - Alarm is still ${newState}`);
        this.addStateHistory('verify_failed', `Verification: alarm still ${newState} after arm attempt`);
      }
      
    } catch (error) {
      console.error('Failed to verify arm status:', error);
      this.addStateHistory('verify_error', `Could not verify arm status: ${error.message}`);
    }
  }

  addStateHistory(action, details, metadata = {}) {
    const entry = {
      timestamp: new Date(),
      action,
      details,
      alarmState: this.lastAlarmState,
      inWindow: this.isInArmingWindow(),
      ...metadata
    };
    
    this.stateHistory.push(entry);
    if (this.stateHistory.length > 100) {
      this.stateHistory = this.stateHistory.slice(-100);
    }
  }

  getDebugInfo() {
    const now = new Date();
    return {
      isRunning: this.isRunning,
      lastAlarmState: this.lastAlarmState,
      inArmingWindow: this.isInArmingWindow(),
      currentTime: now.toLocaleTimeString(),
      currentHour: now.getHours(),
      errorCount: this.errorCount,
      stateHistory: this.stateHistory.slice(-15), // More history for debugging
      checkIntervalActive: this.checkInterval !== null,
      automationId: this.automation.id,
      automationName: this.automation.name,
      lastArmAttempt: this.lastArmAttempt ? this.lastArmAttempt.toLocaleTimeString() : null,
      cooldownRemaining: this.lastArmAttempt ? Math.max(0, this.armCooldown - (now - this.lastArmAttempt)) : 0
    };
  }
}

export default AlarmAutoArmComponent;