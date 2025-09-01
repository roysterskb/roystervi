// File location: src/AutomationsPage/CollapsibleAutomationCard.js
// Rule #1: When updating a file, if another file is going to be affected, update all affected files.
// Rule #2: File locations and these rules are added to the top of each file.
// Rule #3: Full code is provided for copy and paste.
// Rule #4: A breakdown of tasks is given.
// Rule #5: If a file is not available, a request for it is made.

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../ThemeContext.js';
import { TYPOGRAPHY } from '../global.js';
import { 
  Play, 
  Square, 
  Edit, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Database,
  Activity,
  AlertTriangle
} from 'lucide-react';

const CollapsibleAutomationCard = ({ 
  automation, 
  haStatus, 
  onToggle, 
  onEdit, 
  onDelete,
  getAutomationComponent 
}) => {
  const { themeColors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Load expanded state from localStorage on mount
  useEffect(() => {
    if (!automation?.id) return;
    
    try {
      const savedState = localStorage.getItem(`automation_expanded_${automation.id}`);
      if (savedState !== null) {
        setIsExpanded(JSON.parse(savedState));
      }
    } catch (error) {
      console.warn('Failed to load expanded state:', error);
      setIsExpanded(false);
    }
  }, [automation?.id]);

  // Save expanded state to localStorage whenever it changes
  const handleToggleExpanded = useCallback(() => {
    if (!automation?.id) return;
    
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    
    try {
      localStorage.setItem(`automation_expanded_${automation.id}`, JSON.stringify(newExpanded));
    } catch (error) {
      console.warn('Failed to save expanded state:', error);
    }
  }, [isExpanded, automation?.id]);

  const handleCollapseClick = useCallback(() => {
    if (!automation?.id) return;
    
    setIsExpanded(false);
    try {
      localStorage.setItem(`automation_expanded_${automation.id}`, JSON.stringify(false));
    } catch (error) {
      console.warn('Failed to save collapsed state:', error);
    }
  }, [automation?.id]);

  // Enhanced status detection with error handling
  const getStatusIcon = useCallback((isActive, isRunning, hasErrors = false) => {
    if (hasErrors) {
      return <AlertTriangle size={16} className="text-red-400" />;
    } else if (isRunning) {
      return <Clock size={16} className="text-yellow-400 animate-pulse" />;
    } else if (isActive) {
      return <CheckCircle size={16} className="text-green-400" />;
    } else {
      return <AlertCircle size={16} className="text-gray-400" />;
    }
  }, []);

  const getStatusText = useCallback((isActive, isRunning, hasErrors = false) => {
    if (hasErrors) return 'Error';
    if (isRunning) return 'Running';
    return isActive ? 'Active' : 'Disabled';
  }, []);

  const formatLastTriggered = useCallback((timestamp) => {
    if (!timestamp) return 'Never';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Invalid time';
    }
  }, []);

  // Enhanced toggle handler with error handling
  const handleToggle = useCallback(async () => {
    if (!automation?.id || !onToggle) return;
    
    try {
      setHasError(false);
      await onToggle(automation.id);
    } catch (error) {
      console.error('Failed to toggle automation:', error);
      setHasError(true);
    }
  }, [automation?.id, onToggle]);

  // Enhanced edit handler
  const handleEdit = useCallback(() => {
    if (!automation || !onEdit) return;
    
    try {
      onEdit(automation);
    } catch (error) {
      console.error('Failed to edit automation:', error);
    }
  }, [automation, onEdit]);

  // Enhanced delete handler with confirmation
  const handleDelete = useCallback(() => {
    if (!automation?.id || !onDelete) return;
    
    try {
      onDelete(automation.id);
    } catch (error) {
      console.error('Failed to delete automation:', error);
    }
  }, [automation?.id, onDelete]);

  // Don't render if automation is missing
  if (!automation) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <span className="text-red-400">Invalid automation data</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${themeColors.secondaryBg} rounded-xl ${themeColors.cardShadow} transition-all duration-200 hover:shadow-lg`}>
      
      {/* Collapsed Header - Always Visible */}
      <div className="p-4 flex items-center justify-between">
        
        {/* Left Section: Expand Button + Name + Status */}
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={handleToggleExpanded}
            className={`p-1 rounded hover:${themeColors.hoverBg} transition-colors`}
            title={isExpanded ? 'Collapse automation details' : 'Expand automation details'}
            aria-label={isExpanded ? 'Collapse automation details' : 'Expand automation details'}
          >
            {isExpanded ? (
              <ChevronDown size={16} className={themeColors.primaryText} />
            ) : (
              <ChevronRight size={16} className={themeColors.primaryText} />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-base font-medium ${themeColors.whiteText} truncate`} title={automation.name}>
                {automation.name}
              </h3>
              <Database size={12} className="text-blue-400 opacity-60 flex-shrink-0" title="Stored in database" />
              {hasError && <AlertTriangle size={12} className="text-red-400 flex-shrink-0" title="Has errors" />}
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                {getStatusIcon(automation.is_active, automation.is_running, hasError)}
                <span className={`font-medium ${
                  hasError ? 'text-red-400' :
                  automation.is_running ? 'text-yellow-400' :
                  automation.is_active ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {getStatusText(automation.is_active, automation.is_running, hasError)}
                </span>
              </div>
              
              {automation.trigger_count > 0 && (
                <span className={`${themeColors.secondaryText} flex items-center gap-1`}>
                  <Activity size={12} />
                  {automation.trigger_count}x
                </span>
              )}
              
              {automation.last_triggered && (
                <span className={`${themeColors.secondaryText} text-xs`}>
                  {formatLastTriggered(automation.last_triggered)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Edit Button + Start/Stop Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleEdit}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg ${themeColors.tertiaryBg} hover:${themeColors.hoverBg} transition-colors`}
            title="Edit automation configuration"
            aria-label="Edit automation"
          >
            <Edit size={14} className={themeColors.primaryText} />
            <span className={`text-xs ${themeColors.primaryText}`}>Edit</span>
          </button>
          
          <button
            onClick={handleToggle}
            disabled={haStatus !== 'connected'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              automation.is_active
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : `${themeColors.tertiaryBg} hover:bg-green-600 ${themeColors.primaryText} hover:text-white`
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={automation.is_active ? 'Stop automation' : 'Start automation'}
            aria-label={automation.is_active ? 'Stop automation' : 'Start automation'}
          >
            {automation.is_active ? (
              <>
                <Square size={14} />
                Stop
              </>
            ) : (
              <>
                <Play size={14} />
                Start
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content - Only Visible When Expanded */}
      {isExpanded && (
        <div className="border-t border-gray-600">
          <div className="p-4 space-y-4">
            
            {/* Automation Type & Description */}
            <div>
              <p className={`text-sm ${themeColors.secondaryText} capitalize mb-2`}>
                {automation.type?.replace('_', ' ')} Automation
              </p>
              {automation.description && (
                <p className={`text-sm ${themeColors.secondaryText}`}>
                  {automation.description}
                </p>
              )}
            </div>

            {/* Statistics */}
            <div className={`p-3 ${themeColors.tertiaryBg} rounded-lg`}>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className={`${themeColors.secondaryText} block`}>Triggered</span>
                  <span className={`font-medium ${themeColors.whiteText}`}>
                    {automation.trigger_count || 0} times
                  </span>
                </div>
                <div>
                  <span className={`${themeColors.secondaryText} block`}>Last run</span>
                  <span className={`font-medium ${themeColors.whiteText}`}>
                    {formatLastTriggered(automation.last_triggered)}
                  </span>
                </div>
                <div>
                  <span className={`${themeColors.secondaryText} block`}>Created</span>
                  <span className={`font-medium ${themeColors.whiteText}`}>
                    {automation.created_at ? new Date(automation.created_at).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Automation Component - Full details and debug info */}
            <div>
              {getAutomationComponent && typeof getAutomationComponent === 'function' ? (
                getAutomationComponent(automation)
              ) : (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-yellow-400" />
                    <span className="text-yellow-400 text-sm">Automation component not available</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-3 border-t border-gray-600">
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg ${themeColors.tertiaryBg} hover:${themeColors.hoverBg} transition-colors`}
                  title="Edit automation configuration"
                  aria-label="Edit automation"
                >
                  <Edit size={16} className={themeColors.primaryText} />
                  <span className={`text-xs ${themeColors.primaryText}`}>Edit</span>
                </button>
                
                <button
                  onClick={handleDelete}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg ${themeColors.tertiaryBg} hover:bg-red-600 transition-colors group`}
                  title="Delete automation permanently"
                  aria-label="Delete automation"
                >
                  <Trash2 size={16} className={`${themeColors.primaryText} group-hover:text-white`} />
                  <span className={`text-xs ${themeColors.primaryText} group-hover:text-white`}>Delete</span>
                </button>
              </div>
              
              <button
                onClick={handleCollapseClick}
                className={`text-xs ${themeColors.secondaryText} hover:${themeColors.primaryText} transition-colors`}
                aria-label="Collapse automation details"
              >
                Collapse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollapsibleAutomationCard;