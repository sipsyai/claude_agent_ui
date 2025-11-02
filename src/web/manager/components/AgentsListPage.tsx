
import React, { useState } from 'react';
import type { Agent } from '../types';
import type { SlashCommand, Skill } from '../services/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';

interface AgentsListPageProps {
  commands: SlashCommand[];
  skills: Skill[];
  onSelectAgent: (agent: Agent) => void;
}

const AgentsListPage: React.FC<AgentsListPageProps> = ({ commands, skills, onSelectAgent }) => {
  const [activeTab, setActiveTab] = useState<'commands' | 'skills'>('commands');

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-center">Project Structure</h1>
      <p className="text-muted-foreground text-center mb-8">
        Discovered {commands.length} slash commands and {skills.length} skills
      </p>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-8 gap-4">
        <Button
          variant={activeTab === 'commands' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('commands')}
        >
          Slash Commands ({commands.length})
        </Button>
        <Button
          variant={activeTab === 'skills' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('skills')}
        >
          Skills ({skills.length})
        </Button>
      </div>

      {/* Commands Tab */}
      {activeTab === 'commands' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {commands.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-12">
              No slash commands found in .claude/commands/
            </div>
          ) : (
            commands.map((command) => (
              <Card key={command.id} className="flex flex-col hover:border-primary/80 transition-colors duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-primary">/</span>
                    {command.name}
                  </CardTitle>
                  <CardDescription>
                    {command.description || 'No description'}
                  </CardDescription>
                  {command.category && (
                    <span className="text-xs text-muted-foreground">
                      Category: {command.category}
                    </span>
                  )}
                </CardHeader>
                <CardContent className="flex-grow">
                  {command.metadata?.allowedTools && Array.isArray(command.metadata.allowedTools) && command.metadata.allowedTools.length > 0 && (
                    <div className="mb-2">
                      <h4 className="font-semibold text-sm mb-1 text-muted-foreground">Allowed Tools:</h4>
                      <div className="flex flex-wrap gap-1">
                        {command.metadata.allowedTools.slice(0, 3).map((tool, idx) => (
                          <span key={idx} className="text-xs bg-secondary px-2 py-0.5 rounded">
                            {tool}
                          </span>
                        ))}
                        {command.metadata.allowedTools.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{command.metadata.allowedTools.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    {command.relativePath}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" size="sm">
                    View Details
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-12">
              No skills found in .claude/skills/
            </div>
          ) : (
            skills.map((skill) => (
              <Card key={skill.id} className="flex flex-col hover:border-primary/80 transition-colors duration-300">
                <CardHeader>
                  <CardTitle>{skill.name}</CardTitle>
                  <CardDescription>{skill.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  {skill.toolConfig?.allowedTools && Array.isArray(skill.toolConfig?.allowedTools) && skill.toolConfig?.allowedTools.length > 0 && (
                    <div className="mb-2">
                      <h4 className="font-semibold text-sm mb-1 text-muted-foreground">Allowed Tools:</h4>
                      <div className="flex flex-wrap gap-1">
                        {skill.toolConfig?.allowedTools.slice(0, 3).map((tool, idx) => (
                          <span key={idx} className="text-xs bg-secondary px-2 py-0.5 rounded">
                            {tool}
                          </span>
                        ))}
                        {skill.toolConfig?.allowedTools.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{skill.toolConfig?.allowedTools.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button className="w-full" size="sm">
                    View Details
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AgentsListPage;
   