import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import { InfoIcon } from './ui/Icons';

interface SkillSelectorProps {
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
  disabled?: boolean;
  directory?: string;
}

const SkillSelector: React.FC<SkillSelectorProps> = ({
  selectedSkills,
  onChange,
  disabled = false,
  directory,
}) => {
  const [skills, setSkills] = useState<api.Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<api.Skill | null>(null);

  useEffect(() => {
    loadSkills();
  }, [directory]);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const allSkills = await api.getSkills(directory, true);
      setSkills(allSkills);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skillName: string) => {
    let newSkills: string[];
    if (selectedSkills.includes(skillName)) {
      newSkills = selectedSkills.filter(name => name !== skillName);
    } else {
      newSkills = [...selectedSkills, skillName];
    }
    onChange(newSkills);
  };

  const toggleSelectAll = () => {
    if (selectedSkills.length === filteredSkills.length && filteredSkills.length > 0) {
      onChange([]);
    } else {
      onChange(filteredSkills.map(s => s.name));
    }
  };

  const filterSkills = (skillsList: api.Skill[]): api.Skill[] => {
    if (!searchTerm.trim()) return skillsList;

    const term = searchTerm.toLowerCase();
    return skillsList.filter(skill =>
      skill.name.toLowerCase().includes(term) ||
      skill.description.toLowerCase().includes(term)
    );
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading skills...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded">
        No skills found. Create skills in the Skills section to see them here.
      </div>
    );
  }

  const filteredSkills = filterSkills(skills);
  const allSelected = filteredSkills.length > 0 && selectedSkills.length === filteredSkills.length;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Search skills by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
      </div>

      {/* Summary and Select All */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {selectedSkills.length > 0
            ? `${selectedSkills.length} skill(s) selected`
            : 'No skills selected'}
        </div>
        {filteredSkills.length > 0 && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={disabled}
              className="w-4 h-4 rounded"
            />
            <span className="text-muted-foreground">
              {allSelected ? 'Deselect All' : 'Select All'}
            </span>
          </label>
        )}
      </div>

      {/* Skills List */}
      <div className="border border-border rounded-md max-h-96 overflow-y-auto">
        {filteredSkills.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No skills match your search
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSkills.map((skill) => {
              const isSelected = selectedSkills.includes(skill.name);

              return (
                <div
                  key={skill.id}
                  className="flex items-start gap-2 p-2 rounded hover:bg-secondary/50 transition-colors"
                >
                  <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSkill(skill.name)}
                      disabled={disabled}
                      className="mt-1 w-4 h-4 rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground break-all">
                        {skill.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {skill.description}
                      </div>

                      {/* Usage badge */}
                      {skill.analytics?.executionCount !== undefined && skill.analytics?.executionCount > 0 && (
                        <div className="mt-1">
                          <span className="inline-block text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            Used in {skill.analytics?.executionCount} agent{skill.analytics?.executionCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      {/* Tools badge */}
                      {skill.toolConfig?.allowedTools && skill.toolConfig?.allowedTools.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {skill.toolConfig?.allowedTools.slice(0, 3).map(tool => (
                            <span key={tool} className="inline-block text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">
                              {tool}
                            </span>
                          ))}
                          {skill.toolConfig?.allowedTools.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{skill.toolConfig?.allowedTools.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Info button */}
                  <button
                    type="button"
                    onClick={() => setSelectedSkillDetail(skill)}
                    className="flex-shrink-0 text-muted-foreground hover:text-primary p-1"
                    title="View details"
                  >
                    <InfoIcon className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Skill Detail Modal */}
      {selectedSkillDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSkillDetail(null)}
        >
          <div
            className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold">{selectedSkillDetail.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{selectedSkillDetail.description}</p>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                {/* Usage Info */}
                {selectedSkillDetail.analytics?.executionCount !== undefined && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Usage</h4>
                    <p className="text-sm text-muted-foreground">
                      Used in {selectedSkillDetail.analytics?.executionCount || 0} agent(s)
                      {selectedSkillDetail.agentSelection && selectedSkillDetail.agentSelection.length > 0 && (
                        <>: {selectedSkillDetail.agentSelection.join(', ')}</>
                      )}
                    </p>
                  </div>
                )}

                {/* Allowed Tools */}
                {selectedSkillDetail.toolConfig?.allowedTools && selectedSkillDetail.toolConfig?.allowedTools.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Allowed Tools</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedSkillDetail.toolConfig?.allowedTools.map(tool => (
                        <span key={tool} className="inline-block text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Preview */}
                <div>
                  <h4 className="text-sm font-medium mb-1">Instructions</h4>
                  <pre className="text-xs bg-secondary/50 p-3 rounded border border-border overflow-x-auto max-h-60">
                    {selectedSkillDetail.skillmd}
                  </pre>
                </div>

                {/* File Path */}
                <div>
                  <h4 className="text-sm font-medium mb-1">Location</h4>
                  <p className="text-xs font-mono text-muted-foreground">{selectedSkillDetail.name + ".md"}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedSkillDetail(null)}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillSelector;
