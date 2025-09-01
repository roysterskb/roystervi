// File location: src/AutomationsPage/EntityDiscovery.js
// Complete EntityDiscovery component to find your actual Home Assistant entities

import React, { useState, useCallback } from 'react';
import { useTheme } from '../ThemeContext.js';
import { Search, Eye, Lightbulb, Shield, RefreshCw, CheckCircle, XCircle, X, Activity, Thermometer, Power, Home, Zap } from 'lucide-react';
import AutomationService from '../services/AutomationService.js';

const EntityDiscovery = ({ onEntitiesFound, onClose }) => {
  const { themeColors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [entities, setEntities] = useState([]);
  const [filteredEntities, setFilteredEntities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [error, setError] = useState('');
  const [testingEntities, setTestingEntities] = useState(new Set());
  const [entityStates, setEntityStates] = useState(new Map());

  const entityFilters = [
    { id: 'all', name: 'All Entities', icon: <Search size={16} /> },
    { id: 'alarm_control_panel', name: 'Alarm Panels', icon: <Shield size={16} /> },
    { id: 'binary_sensor', name: 'Motion/Door Sensors', icon: <Eye size={16} /> },
    { id: 'light', name: 'Lights', icon: <Lightbulb size={16} /> },
    { id: 'switch', name: 'Switches', icon: <Power size={16} /> },
    { id: 'sensor', name: 'Sensors', icon: <Thermometer size={16} /> },
    { id: 'climate', name: 'Climate', icon: <Home size={16} /> },
    { id: 'cover', name: 'Covers', icon: <Activity size={16} /> }
  ];

  const discoverEntities = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setEntities([]);
    setFilteredEntities([]);

    try {
      console.log('EntityDiscovery: Discovering Home Assistant entities...');
      
      // Initialize the service first
      await AutomationService.initialize();
      
      const allEntities = await AutomationService.getAllHAEntities();
      
      if (!allEntities || allEntities.length === 0) {
        throw new Error('No entities found. Check your Home Assistant connection.');
      }

      console.log(`EntityDiscovery: Found ${allEntities.length} entities`);
      
      // Sort entities by domain and friendly name
      const sortedEntities = allEntities.sort((a, b) => {
        const aDomain = a.entity_id.split('.')[0];
        const bDomain = b.entity_id.split('.')[0];
        
        if (aDomain !== bDomain) {
          return aDomain.localeCompare(bDomain);
        }
        
        const aName = a.attributes.friendly_name || a.entity_id;
        const bName = b.attributes.friendly_name || b.entity_id;
        return aName.localeCompare(bName);
      });

      setEntities(sortedEntities);
      setFilteredEntities(sortedEntities);

      if (onEntitiesFound) {
        onEntitiesFound(sortedEntities);
      }

    } catch (error) {
      console.error('EntityDiscovery: Failed to discover entities:', error);
      setError(`Failed to discover entities: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [onEntitiesFound]);

  // Filter entities based on search term and selected filter
  const filterEntities = useCallback(() => {
    let filtered = entities;

    // Apply domain filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(entity => 
        entity.entity_id.startsWith(selectedFilter + '.')
      );
    }

    // Apply search term filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(entity => {
        const friendlyName = entity.attributes.friendly_name || '';
        return entity.entity_id.toLowerCase().includes(search) ||
               friendlyName.toLowerCase().includes(search);
      });
    }

    setFilteredEntities(filtered);
  }, [entities, searchTerm, selectedFilter]);

  // Update filtered entities when filters change
  React.useEffect(() => {
    filterEntities();
  }, [filterEntities]);

  // Test individual entity
  const testEntity = useCallback(async (entityId) => {
    setTestingEntities(prev => new Set([...prev, entityId]));

    try {
      console.log('EntityDiscovery: Testing entity:', entityId);
      const state = await AutomationService.getHAEntityState(entityId);
      
      setEntityStates(prev => new Map([...prev, [entityId, { 
        success: true, 
        state: state.state,
        lastChanged: state.last_changed,
        attributes: state.attributes
      }]]));
      
      console.log('EntityDiscovery: Entity test successful:', entityId, state.state);
    } catch (error) {
      console.error('EntityDiscovery: Entity test failed:', entityId, error);
      setEntityStates(prev => new Map([...prev, [entityId, { 
        success: false, 
        error: error.message 
      }]]));
    } finally {
      setTestingEntities(prev => {
        const newSet = new Set(prev);
        newSet.delete(entityId);
        return newSet;
      });
    }
  }, []);

  // Get entity icon based on domain
  const getEntityIcon = useCallback((entityId, state) => {
    const domain = entityId.split('.')[0];
    
    switch (domain) {
      case 'alarm_control_panel':
        return <Shield size={16} className={state === 'armed_away' ? 'text-green-400' : 'text-red-400'} />;
      case 'binary_sensor':
        return <Eye size={16} className={state === 'on' ? 'text-yellow-400' : 'text-gray-400'} />;
      case 'light':
        return <Lightbulb size={16} className={state === 'on' ? 'text-yellow-400' : 'text-gray-400'} />;
      case 'switch':
        return <Power size={16} className={state === 'on' ? 'text-green-400' : 'text-gray-400'} />;
      case 'sensor':
        return <Thermometer size={16} className="text-blue-400" />;
      case 'climate':
        return <Home size={16} className="text-orange-400" />;
      case 'cover':
        return <Activity size={16} className={state === 'open' ? 'text-green-400' : 'text-gray-400'} />;
      case 'automation':
        return <Zap size={16} className={state === 'on' ? 'text-purple-400' : 'text-gray-400'} />;
      default:
        return <Activity size={16} className="text-gray-400" />;
    }
  }, []);

  // Format entity state for display
  const formatEntityState = useCallback((entity, stateInfo) => {
    if (!stateInfo) return entity.state || 'Unknown';
    
    if (!stateInfo.success) {
      return `Error: ${stateInfo.error}`;
    }

    const domain = entity.entity_id.split('.')[0];
    const state = stateInfo.state;
    const attributes = stateInfo.attributes;

    switch (domain) {
      case 'sensor':
        const unit = attributes?.unit_of_measurement;
        return unit ? `${state} ${unit}` : state;
      case 'binary_sensor':
        return state === 'on' ? 'Detected' : 'Clear';
      case 'light':
      case 'switch':
        return state === 'on' ? 'On' : 'Off';
      case 'alarm_control_panel':
        return state.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      case 'cover':
        return state === 'open' ? 'Open' : state === 'closed' ? 'Closed' : state;
      case 'climate':
        const temp = attributes?.current_temperature;
        const target = attributes?.temperature;
        return temp ? `${temp}°${target ? ` → ${target}°` : ''}` : state;
      default:
        return state;
    }
  }, []);

  // Get entity count by domain
  const getEntityCount = useCallback((domain) => {
    if (domain === 'all') return entities.length;
    return entities.filter(entity => entity.entity_id.startsWith(domain + '.')).length;
  }, [entities]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        style={{ backgroundColor: themeColors.cardBackground }}
      >
        {/* Header */}
        <div 
          className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between"
          style={{ borderColor: themeColors.border }}
        >
          <div className="flex items-center space-x-3">
            <Search size={24} style={{ color: themeColors.primary }} />
            <h2 className="text-xl font-semibold" style={{ color: themeColors.text }}>
              Entity Discovery
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            style={{ color: themeColors.textSecondary }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-full max-h-[calc(90vh-80px)]">
          {/* Controls */}
          <div className="p-6 border-b dark:border-gray-700" style={{ borderColor: themeColors.border }}>
            <div className="flex flex-col space-y-4">
              {/* Discover Button */}
              <button
                onClick={discoverEntities}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: themeColors.primary,
                  color: themeColors.cardBackground
                }}
              >
                {isLoading ? (
                  <RefreshCw size={20} className="animate-spin" />
                ) : (
                  <Search size={20} />
                )}
                <span>{isLoading ? 'Discovering Entities...' : 'Discover Home Assistant Entities'}</span>
              </button>

              {/* Search */}
              <div className="relative">
                <Search size={20} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-50 dark:bg-gray-700 dark:border-gray-600"
                  style={{
                    borderColor: themeColors.border,
                    backgroundColor: themeColors.inputBackground,
                    color: themeColors.text
                  }}
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                {entityFilters.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedFilter === filter.id 
                        ? 'text-white' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    style={{
                      backgroundColor: selectedFilter === filter.id 
                        ? themeColors.primary 
                        : 'transparent',
                      color: selectedFilter === filter.id 
                        ? themeColors.cardBackground 
                        : themeColors.textSecondary
                    }}
                  >
                    {filter.icon}
                    <span>{filter.name}</span>
                    <span className="text-xs opacity-75">
                      ({getEntityCount(filter.id)})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Entity List */}
          <div className="flex-1 overflow-auto">
            {filteredEntities.length > 0 ? (
              <div className="p-6">
                <div className="grid gap-3">
                  {filteredEntities.map(entity => {
                    const entityState = entityStates.get(entity.entity_id);
                    const isTesting = testingEntities.has(entity.entity_id);
                    
                    return (
                      <div
                        key={entity.entity_id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        style={{
                          borderColor: themeColors.border,
                          backgroundColor: themeColors.cardBackground
                        }}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {getEntityIcon(entity.entity_id, entity.state)}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h3 
                                className="font-medium truncate"
                                style={{ color: themeColors.text }}
                              >
                                {entity.attributes.friendly_name || entity.entity_id}
                              </h3>
                              <span 
                                className="text-xs px-2 py-1 rounded-full"
                                style={{ 
                                  backgroundColor: `${themeColors.primary}20`,
                                  color: themeColors.primary
                                }}
                              >
                                {entity.entity_id.split('.')[0]}
                              </span>
                            </div>
                            
                            <p 
                              className="text-sm truncate"
                              style={{ color: themeColors.textSecondary }}
                            >
                              {entity.entity_id}
                            </p>
                            
                            {entityState && (
                              <div className="flex items-center space-x-2 mt-1">
                                {entityState.success ? (
                                  <CheckCircle size={14} className="text-green-500" />
                                ) : (
                                  <XCircle size={14} className="text-red-500" />
                                )}
                                <span 
                                  className="text-sm"
                                  style={{ 
                                    color: entityState.success 
                                      ? themeColors.text 
                                      : '#ef4444'
                                  }}
                                >
                                  {formatEntityState(entity, entityState)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => testEntity(entity.entity_id)}
                            disabled={isTesting}
                            className="px-3 py-1 text-sm rounded-lg border transition-colors disabled:opacity-50"
                            style={{
                              borderColor: themeColors.border,
                              color: themeColors.primary,
                              backgroundColor: 'transparent'
                            }}
                          >
                            {isTesting ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              'Test'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : entities.length > 0 ? (
              <div className="flex items-center justify-center h-32">
                <p style={{ color: themeColors.textSecondary }}>
                  No entities match your search criteria
                </p>
              </div>
            ) : !isLoading && (
              <div className="flex items-center justify-center h-32">
                <p style={{ color: themeColors.textSecondary }}>
                  Click "Discover Home Assistant Entities" to start
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {entities.length > 0 && (
            <div 
              className="px-6 py-4 border-t dark:border-gray-700 flex items-center justify-between"
              style={{ borderColor: themeColors.border }}
            >
              <span style={{ color: themeColors.textSecondary }}>
                Found {entities.length} entities • Showing {filteredEntities.length}
              </span>
              
              <div className="flex space-x-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg transition-colors"
                  style={{
                    borderColor: themeColors.border,
                    color: themeColors.textSecondary
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntityDiscovery;