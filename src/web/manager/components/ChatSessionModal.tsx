import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import * as chatApi from '../services/chat-api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { XIcon } from './ui/Icons';

interface ChatSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (session: chatApi.ChatSession) => void;
}

const ChatSessionModal: React.FC<ChatSessionModalProps> = ({ isOpen, onClose, onChatCreated }) => {
  const [title, setTitle] = useState('');
  const [availableSkills, setAvailableSkills] = useState<api.Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [availableAgents, setAvailableAgents] = useState<api.Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Get directory from cookies
  const getDirectory = () => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'selectedDirectory') {
        return decodeURIComponent(value);
      }
    }
    return undefined;
  };

  useEffect(() => {
    loadSkills();
    loadAgents();
  }, []);

  const loadSkills = async () => {
    try {
      setSkillsLoading(true);
      const directory = getDirectory();
      const skills = await api.getSkills(directory);
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Failed to load skills:', error);
      alert('Failed to load skills');
    } finally {
      setSkillsLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      setAgentsLoading(true);
      const directory = getDirectory();
      const agents = await api.getAgents(directory);
      setAvailableAgents(agents);
    } catch (error) {
      console.error('Failed to load agents:', error);
      // Don't show alert - agents are optional
    } finally {
      setAgentsLoading(false);
    }
  };

  const handleToggleSkill = (skillId: string) => {
    setSelectedSkillIds(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  const handleCreate = async () => {
    if (selectedSkillIds.length === 0) {
      if (!confirm('No skills selected. Continue anyway?')) {
        return;
      }
    }

    try {
      setLoading(true);
      const directory = getDirectory();
      // Use "New Chat" as default title if empty
      const finalTitle = title.trim() || 'New Chat';
      const session = await chatApi.createChatSession(
        finalTitle,
        selectedSkillIds,
        directory,
        'default', // Default permission mode
        selectedAgentId || undefined, // Agent ID (optional)
        undefined // Custom system prompt (not implemented in UI yet)
      );
      onChatCreated(session);
    } catch (error) {
      console.error('Failed to create chat session:', error);
      alert('Failed to create chat session');
    } finally {
      setLoading(false);
    }
  };

  // Filter skills based on search term
  const filteredSkills = availableSkills.filter(skill =>
    skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skill.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skill.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-gray-800 border-gray-700 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-bold">New Chat Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
        {/* Title Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">
            Chat Title <span className="text-xs text-gray-400 font-normal">(optional - defaults to "New Chat")</span>
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leave empty for auto-generated title..."
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 text-base"
          />
        </div>

        {/* Skills Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">
            Select Skills <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </label>

          {/* Search Input */}
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search skills..."
            className="mb-2 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 text-base"
          />

          {/* Skills List */}
          <div className="border border-gray-700 rounded-lg max-h-[200px] overflow-y-auto bg-gray-900">
            {skillsLoading ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                Loading skills...
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No skills found
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {filteredSkills.map(skill => (
                  <label
                    key={skill.id}
                    className="flex items-start gap-2.5 p-2.5 hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkillIds.includes(skill.id)}
                      onChange={() => handleToggleSkill(skill.id)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
                    />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-white truncate">
                          {skill.displayName || skill.name}
                        </p>
                        {skill.category && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white flex-shrink-0">
                            {skill.category}
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-xs text-gray-400 line-clamp-1 break-words">
                          {skill.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Selected Count */}
          {selectedSkillIds.length > 0 && (
            <div className="mt-2 text-sm font-medium text-blue-400">
              ✓ {selectedSkillIds.length} skill{selectedSkillIds.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* Agent Selection */}
        <div>
          <label htmlFor="agent-select" className="block text-sm font-semibold text-gray-200 mb-2">
            Select Agent <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </label>

          <select
            id="agent-select"
            value={selectedAgentId || ''}
            onChange={(e) => setSelectedAgentId(e.target.value || null)}
            disabled={agentsLoading}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            <option value="">None (Default Claude)</option>
            {availableAgents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name}{agent.modelConfig?.model ? ` [${agent.modelConfig.model}]` : ''}
              </option>
            ))}
          </select>

          {selectedAgentId && (
            <div className="mt-2 text-xs text-gray-400">
              {availableAgents.find(a => a.id === selectedAgentId)?.description}
            </div>
          )}
        </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700 mt-4 flex-shrink-0">
          <Button onClick={onClose} variant="secondary" className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600 text-base px-5 py-2.5">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="primary"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 text-base px-5 py-2.5"
          >
            {loading ? 'Creating...' : 'Create Chat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatSessionModal;
