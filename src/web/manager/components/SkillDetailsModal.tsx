import React from 'react';
import type { Skill } from '../../../types/agent.types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Button } from './ui/Button';

interface SkillDetailsModalProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (skill: Skill) => void;
}

const SkillDetailsModal: React.FC<SkillDetailsModalProps> = ({ skill, isOpen, onClose, onEdit }) => {
  if (!skill) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{skill.name}</DialogTitle>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Metadata Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Metadata</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="font-medium text-muted-foreground">ID:</span>
                <span className="col-span-2">{skill.id}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="font-medium text-muted-foreground">Name:</span>
                <span className="col-span-2 font-mono text-xs break-all">{skill.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="font-medium text-muted-foreground">Category:</span>
                <span className="col-span-2">{skill.category || 'general'}</span>
              </div>
            </div>
          </div>

          {/* Allowed Tools Section */}
          {skill.toolConfig?.allowedTools && skill.toolConfig.allowedTools.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Allowed Tools</h3>
              <div className="flex flex-wrap gap-2">
                {skill.toolConfig.allowedTools.map((tool, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-secondary text-secondary-foreground rounded-md text-sm font-medium"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Content Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Instructions</h3>
            <div className="bg-muted p-4 rounded-md overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">{skill.skillmd}</pre>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {onEdit && (
            <Button variant="secondary" onClick={() => onEdit(skill)}>
              Edit
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SkillDetailsModal;
