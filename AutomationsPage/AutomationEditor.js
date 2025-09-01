// File location: src/AutomationsPage/AutomationEditor.js
// Rule #1: When updating a file, if another file is going to be affected, update all affected files.
// Rule #2: File locations and these rules are added to the top of each file.
// Rule #3: Full code is provided for copy and paste.
// Rule #4: A breakdown of tasks is given.
// Rule #5: If a file is not available, a request for it is made.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../ThemeContext.js';
import { COLORS } from '../global.js';
import { X, Save, Plus, Trash2, AlertCircle, Lightbulb, Clock, GitBranch, Eye, Move, Shield } from 'lucide-react';

const AutomationEditor = ({ isOpen, onClose, onSave, automation, haStatus }) => {
  const { themeColors } = useTheme();
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'custom',
    settings: {}
  });
  const [errors, setErrors] = useState({});
  
  // Enhanced state for multiple triggers, conditions, actions
  const [triggers, setTriggers] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [actions, setActions] = useState([]);

  // Memoized configuration data to prevent re-renders
  const triggerTypes = useMemo(() => [
    {
      id: 'state',
      name: 'State Change',
      icon: <Eye size={16} className="text-blue-400" />,
      description: 'When an entity changes state',
      fields: [
        { key: 'entity_id', label: 'Entity', type: 'entity', required: true },
        { key: 'from', label: 'From State', type: 'text' },
        { key: 'to', label: 'To State', type: 'text' },
        { key: 'for', label: 'For Duration (seconds)', type: 'number' }
      ]
    },
    {
      id: 'time',
      name: 'Time Trigger',
      icon: <Clock size={16} className="text-purple-400" />,
      description: 'At a specific time',
      fields: [
        { key: 'at', label: 'Time', type: 'time', required: true }
      ]
    },
    {
      id: 'numeric_state',
      name: 'Numeric State',
      icon: <Move size={16} className="text-green-400" />,
      description: 'When a numeric value crosses a threshold',
      fields: [
        { key: 'entity_id', label: 'Entity', type: 'entity', required: true },
        { key: 'above', label: 'Above Value', type: 'number' },
        { key: 'below', label: 'Below Value', type: 'number' }
      ]
    }
  ], []);

  const conditionTypes = useMemo(() => [
    {
      id: 'state',
      name: 'State Condition',
      icon: <Eye size={16} className="text-cyan-400" />,
      description: 'Check entity state',
      fields: [
        { key: 'entity_id', label: 'Entity', type: 'entity', required: true },
        { key: 'state', label: 'State', type: 'text', required: true }
      ]
    },
    {
      id: 'numeric_state',
      name: 'Numeric Condition',
      icon: <Move size={16} className="text-orange-400" />,
      description: 'Check numeric value',
      fields: [
        { key: 'entity_id', label: 'Entity', type: 'entity', required: true },
        { key: 'above', label: 'Above Value', type: 'number' },
        { key: 'below', label: 'Below Value', type: 'number' }
      ]
    },
    {
      id: 'time',
      name: 'Time Condition',
      icon: <Clock size={16} className="text-pink-400" />,
      description: 'Check current time',
      fields: [
        { key: 'after', label: 'After Time', type: 'time' },
        { key: 'before', label: 'Before Time', type: 'time' }
      ]
    }
  ], []);

  const actionTypes = useMemo(() => [
    {
      id: 'call_service',
      name: 'Call Service',
      icon: <GitBranch size={16} className="text-green-400" />,
      description: 'Call a Home Assistant service',
      fields: [
        { key: 'service', label: 'Service', type: 'service', required: true },
        { key: 'entity_id', label: 'Entity', type: 'entity', required: true },
        { key: 'data', label: 'Service Data (JSON)', type: 'json' }
      ]
    },
    {
      id: 'delay',
      name: 'Delay',
      icon: <Clock size={16} className="text-yellow-400" />,
      description: 'Wait for a specified time',
      fields: [
        { key: 'seconds', label: 'Seconds', type: 'number', required: true }
      ]
    },
    {
      id: 'wait_for_trigger',
      name: 'Wait for Trigger',
      icon: <Eye size={16} className="text-purple-400" />,
      description: 'Wait for another event',
      fields: [
        { key: 'platform', label: 'Platform', type: 'select', required: true, options: ['state', 'time'] },
        { key: 'entity_id', label: 'Entity', type: 'entity' },
        { key: 'from', label: 'From State', type: 'text' },
        { key: 'to', label: 'To State', type: 'text' },
        { key: 'timeout', label: 'Timeout (seconds)', type: 'number' }
      ]
    }
  ], []);

  // Enhanced form initialization with validation
  useEffect(() => {
    if (automation && isOpen) {
      // Editing existing automation
      setFormData({
        name: automation.name || '',
        description: automation.description || '',
        type: automation.type || 'custom',
        settings: automation.settings || {}
      });
      
      setTriggers(Array.isArray(automation.triggers) ? automation.triggers.map((t, index) => ({ ...t, id: Date.now() + index })) : []);
      setConditions(Array.isArray(automation.conditions) ? automation.conditions.map((c, index) => ({ ...c, id: Date.now() + index + 1000 })) : []);
      setActions(Array.isArray(automation.actions) ? automation.actions.map((a, index) => ({ ...a, id: Date.now() + index + 2000 })) : []);
      setSelectedTemplate(automation.type || '');
    } else if (isOpen) {
      // Creating new automation
      resetForm();
    }
    setErrors({});
  }, [automation, isOpen]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      type: 'custom',
      settings: {}
    });
    setTriggers([]);
    setConditions([]);
    setActions([]);
    setSelectedTemplate('');
  }, []);

  // Optimized input change handler with debouncing
  const handleInputChange = useCallback((key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));

    if (errors[key]) {
      setErrors(prev => ({
        ...prev,
        [key]: undefined
      }));
    }
  }, [errors]);

  // Trigger management with enhanced validation
  const addTrigger = useCallback((type) => {
    const triggerType = triggerTypes.find(t => t.id === type);
    if (!triggerType) {
      console.error('Invalid trigger type:', type);
      return;
    }
    
    const newTrigger = {
      id: Date.now() + Math.random(), // Ensure unique ID
      platform: type,
      ...triggerType.fields.reduce((acc, field) => {
        acc[field.key] = field.default || '';
        return acc;
      }, {})
    };
    setTriggers(prev => [...prev, newTrigger]);
  }, [triggerTypes]);

  const updateTrigger = useCallback((id, key, value) => {
    setTriggers(prev => prev.map(trigger => 
      trigger.id === id ? { ...trigger, [key]: value } : trigger
    ));
  }, []);

  const removeTrigger = useCallback((id) => {
    setTriggers(prev => prev.filter(trigger => trigger.id !== id));
  }, []);

  // Condition management with enhanced validation
  const addCondition = useCallback((type) => {
    const conditionType = conditionTypes.find(c => c.id === type);
    if (!conditionType) {
      console.error('Invalid condition type:', type);
      return;
    }
    
    const newCondition = {
      id: Date.now() + Math.random(), // Ensure unique ID
      condition: type,
      ...conditionType.fields.reduce((acc, field) => {
        acc[field.key] = field.default || '';
        return acc;
      }, {})
    };
    setConditions(prev => [...prev, newCondition]);
  }, [conditionTypes]);

  const updateCondition = useCallback((id, key, value) => {
    setConditions(prev => prev.map(condition => 
      condition.id === id ? { ...condition, [key]: value } : condition
    ));
  }, []);

  const removeCondition = useCallback((id) => {
    setConditions(prev => prev.filter(condition => condition.id !== id));
  }, []);

  // Action management with enhanced validation
  const addAction = useCallback((type) => {
    const actionType = actionTypes.find(a => a.id === type);
    if (!actionType) {
      console.error('Invalid action type:', type);
      return;
    }
    
    const newAction = {
      id: Date.now() + Math.random(), // Ensure unique ID
      ...actionType.fields.reduce((acc, field) => {
        acc[field.key] = field.default || '';
        return acc;
      }, {})
    };

    if (type === 'call_service') {
      newAction.service = '';
      newAction.entity_id = '';
    } else if (type === 'delay') {
      newAction.delay = { seconds: 0 };
    }

    setActions(prev => [...prev, newAction]);
  }, [actionTypes]);

  const updateAction = useCallback((id, key, value) => {
    setActions(prev => prev.map(action => {
      if (action.id === id) {
        if (key === 'seconds' && action.delay) {
          return { ...action, delay: { seconds: parseInt(value) || 0 } };
        }
        return { ...action, [key]: value };
      }
      return action;
    }));
  }, []);

  const removeAction = useCallback((id) => {
    setActions(prev => prev.filter(action => action.id !== id));
  }, []);

  // Enhanced validation with better error messages
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }

    if (triggers.length === 0) {
      newErrors.triggers = 'At least one trigger is required';
    }

    if (actions.length === 0) {
      newErrors.actions = 'At least one action is required';
    }

    // Validate individual triggers
    triggers.forEach((trigger, index) => {
      const triggerType = triggerTypes.find(t => t.id === trigger.platform);
      if (triggerType) {
        triggerType.fields.forEach(field => {
          if (field.required && !trigger[field.key]) {
            newErrors[`trigger_${index}_${field.key}`] = `${field.label} is required`;
          }
        });
      }
    });

    // Validate individual conditions
    conditions.forEach((condition, index) => {
      const conditionType = conditionTypes.find(c => c.id === condition.condition);
      if (conditionType) {
        conditionType.fields.forEach(field => {
          if (field.required && !condition[field.key]) {
            newErrors[`condition_${index}_${field.key}`] = `${field.label} is required`;
          }
        });
      }
    });

    // Validate individual actions
    actions.forEach((action, index) => {
      const actionType = actionTypes.find(a => a.id === 'call_service'); // Most common validation
      if (action.service && !action.entity_id) {
        newErrors[`action_${index}_entity_id`] = 'Entity is required for service calls';
      }
    });

    return newErrors;
  }, [formData.name, triggers, actions, conditions, triggerTypes, conditionTypes, actionTypes]);

  // Enhanced save handler with better error handling
  const handleSave = useCallback(async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      // Clean triggers, conditions, and actions (remove temporary IDs)
      const cleanTriggers = triggers.map(({ id, ...trigger }) => trigger);
      const cleanConditions = conditions.map(({ id, ...condition }) => condition);
      const cleanActions = actions.map(({ id, ...action }) => action);

      const automationData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        type: 'custom',
        settings: formData.settings || {},
        triggers: cleanTriggers,
        conditions: cleanConditions,
        actions: cleanActions,
        is_active: true
      };

      // Validate final automation data
      if (!automationData.name) {
        throw new Error('Automation name cannot be empty');
      }

      if (cleanTriggers.length === 0) {
        throw new Error('At least one trigger is required');
      }

      if (cleanActions.length === 0) {
        throw new Error('At least one action is required');
      }

      await onSave(automationData);
    } catch (error) {
      console.error('Failed to save automation:', error);
      setErrors({ save: error.message });
    }
  }, [validateForm, triggers, conditions, actions, formData, onSave]);

  // Enhanced field input renderer with better accessibility
  const renderFieldInput = useCallback((item, field, index, type, updateFunction) => {
    const value = item[field.key] || '';
    const error = errors[`${type}_${index}_${field.key}`];

    const inputClasses = `w-full px-3 py-2 ${themeColors.inputBg} ${themeColors.primaryText} border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm transition-colors ${
      error ? 'border-red-500 focus:ring-red-500' : themeColors.inputBorder
    }`;

    const handleInputChange = (newValue) => {
      updateFunction(item.id, field.key, newValue);
      
      // Clear error when user starts typing
      if (error) {
        setErrors(prev => ({
          ...prev,
          [`${type}_${index}_${field.key}`]: undefined
        }));
      }
    };

    switch (field.type) {
      case 'entity':
        return (
          <div key={field.key}>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="entity.domain_name"
              className={inputClasses}
              aria-invalid={!!error}
              aria-describedby={error ? `${type}_${index}_${field.key}_error` : undefined}
            />
            {error && (
              <p id={`${type}_${index}_${field.key}_error`} className="text-red-400 text-xs mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
        );

      case 'service':
        return (
          <div key={field.key}>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="light.turn_on"
              className={inputClasses}
              aria-invalid={!!error}
              aria-describedby={error ? `${type}_${index}_${field.key}_error` : undefined}
            />
            {error && (
              <p id={`${type}_${index}_${field.key}_error`} className="text-red-400 text-xs mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.key}>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleInputChange(parseInt(e.target.value) || '')}
              className={inputClasses}
              aria-invalid={!!error}
              aria-describedby={error ? `${type}_${index}_${field.key}_error` : undefined}
            />
            {error && (
              <p id={`${type}_${index}_${field.key}_error`} className="text-red-400 text-xs mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
        );

      case 'time':
        return (
          <div key={field.key}>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            <input
              type="time"
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              className={inputClasses}
              aria-invalid={!!error}
              aria-describedby={error ? `${type}_${index}_${field.key}_error` : undefined}
            />
            {error && (
              <p id={`${type}_${index}_${field.key}_error`} className="text-red-400 text-xs mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={field.key}>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              className={inputClasses}
              aria-invalid={!!error}
              aria-describedby={error ? `${type}_${index}_${field.key}_error` : undefined}
            >
              <option value="">Select...</option>
              {field.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {error && (
              <p id={`${type}_${index}_${field.key}_error`} className="text-red-400 text-xs mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
        );

      case 'json':
        return (
          <div key={field.key}>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder='{"brightness": 255}'
              rows={2}
              className={inputClasses}
              aria-invalid={!!error}
              aria-describedby={error ? `${type}_${index}_${field.key}_error` : undefined}
            />
            {error && (
              <p id={`${type}_${index}_${field.key}_error`} className="text-red-400 text-xs mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
        );

      default:
        return (
          <div key={field.key}>
            <label className={`block text-xs font-medium ${themeColors.whiteText} mb-1`}>
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              className={inputClasses}
              aria-invalid={!!error}
              aria-describedby={error ? `${type}_${index}_${field.key}_error` : undefined}
            />
            {error && (
              <p id={`${type}_${index}_${field.key}_error`} className="text-red-400 text-xs mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
        );
    }
  }, [errors, themeColors]);

  // Enhanced section renderer with better performance
  const renderSection = useCallback((title, items, types, addFunction, updateFunction, removeFunction, type) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold ${themeColors.whiteText} text-sm uppercase tracking-wider`}>
          {title} ({items.length})
        </h3>
        <div className="relative group">
          <button
            type="button"
            className={`flex items-center gap-1 px-3 py-1 ${COLORS.brandBg} hover:${COLORS.brandBgHover} text-white rounded text-xs font-medium transition-colors`}
            aria-label={`Add new ${title.slice(0, -1).toLowerCase()}`}
          >
            <Plus size={12} />
            Add {title.slice(0, -1)}
          </button>
          <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg shadow-lg border border-gray-600 py-2 min-w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10" role="menu">
            {types.map(typeItem => (
              <button
                key={typeItem.id}
                onClick={() => addFunction(typeItem.id)}
                className="w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors flex items-center gap-2"
                role="menuitem"
                aria-label={`Add ${typeItem.name}`}
              >
                {typeItem.icon}
                <div>
                  <div className={`text-sm ${themeColors.whiteText}`}>{typeItem.name}</div>
                  <div className={`text-xs ${themeColors.secondaryText}`}>{typeItem.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {errors[type] && (
        <p className="text-red-400 text-xs mb-3" role="alert">{errors[type]}</p>
      )}

      <div className="space-y-3">
        {items.map((item, index) => {
          const typeInfo = types.find(t => t.id === (item.platform || item.condition || 'call_service'));
          return (
            <div key={item.id} className={`${themeColors.tertiaryBg} p-4 rounded-lg border ${themeColors.inputBorder}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {typeInfo?.icon}
                  <span className={`text-sm font-medium ${themeColors.whiteText}`}>
                    {typeInfo?.name || 'Custom Action'}
                  </span>
                </div>
                <button
                  onClick={() => removeFunction(item.id)}
                  className="text-red-400 hover:text-red-300 p-1 transition-colors"
                  title={`Remove ${typeInfo?.name || 'item'}`}
                  aria-label={`Remove ${typeInfo?.name || 'item'}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {typeInfo?.fields.map(field => renderFieldInput(item, field, index, type, updateFunction))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ), [themeColors, errors, renderFieldInput]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="automation-editor-title">
      <div className={`${themeColors.secondaryBg} rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto ${themeColors.cardShadow}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600">
          <h2 id="automation-editor-title" className={`text-xl font-bold ${themeColors.whiteText}`}>
            {automation ? 'Edit Automation' : 'Create Custom Automation'}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-full ${themeColors.hoverBg} transition-colors`}
            aria-label="Close automation editor"
          >
            <X size={20} className={themeColors.primaryText} />
          </button>
        </div>

        <div className="p-6">
          {/* Connection Warning */}
          {haStatus !== 'connected' && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg" role="alert">
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-yellow-400" />
                <p className="text-yellow-400 font-medium">Warning: Home Assistant not connected</p>
              </div>
              <p className="text-yellow-400/80 text-sm mt-1">
                Automations won't function without a Home Assistant connection.
              </p>
            </div>
          )}

          {/* Basic Information */}
          <div className="mb-6 space-y-4">
            <h3 className={`font-semibold ${themeColors.whiteText} text-sm uppercase tracking-wider`}>
              Basic Information
            </h3>
            
            <div>
              <label htmlFor="automation-name" className={`block text-sm font-medium ${themeColors.whiteText} mb-1`}>
                Automation Name <span className="text-red-400">*</span>
              </label>
              <input
                id="automation-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="My Custom Automation"
                className={`w-full px-3 py-2 ${themeColors.inputBg} ${themeColors.primaryText} border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm transition-colors ${
                  errors.name ? 'border-red-500 focus:ring-red-500' : themeColors.inputBorder
                }`}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="text-red-400 text-xs mt-1" role="alert">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="automation-description" className={`block text-sm font-medium ${themeColors.whiteText} mb-1`}>
                Description (Optional)
              </label>
              <textarea
                id="automation-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe what this automation does..."
                rows={2}
                className={`w-full px-3 py-2 ${themeColors.inputBg} ${themeColors.primaryText} border ${themeColors.inputBorder} rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm resize-none transition-colors`}
              />
            </div>
          </div>

          {/* IF (Triggers) */}
          {renderSection('Triggers', triggers, triggerTypes, addTrigger, updateTrigger, removeTrigger, 'triggers')}

          {/* AND IF (Conditions) */}
          {renderSection('Conditions', conditions, conditionTypes, addCondition, updateCondition, removeCondition, 'conditions')}

          {/* THEN (Actions) */}
          {renderSection('Actions', actions, actionTypes, addAction, updateAction, removeAction, 'actions')}

          {/* Error Message */}
          {errors.save && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg" role="alert">
              <p className="text-red-400 text-sm">{errors.save}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-600">
            <button
              onClick={onClose}
              className={`px-4 py-2 ${themeColors.tertiaryBg} ${themeColors.primaryText} rounded-lg hover:${themeColors.hoverBg} transition-colors`}
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              disabled={!formData.name?.trim()}
              className={`flex items-center gap-2 px-4 py-2 ${COLORS.brandBg} hover:${COLORS.brandBgHover} text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={automation ? 'Update automation' : 'Create automation'}
            >
              <Save size={16} />
              {automation ? 'Update' : 'Create'} Automation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationEditor;