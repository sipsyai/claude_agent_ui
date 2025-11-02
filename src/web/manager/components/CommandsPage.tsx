import React from 'react';
import type { SlashCommand } from '../services/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';

interface CommandsPageProps {
  commands: SlashCommand[];
}

const CommandsPage: React.FC<CommandsPageProps> = ({ commands }) => {
  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-center">Slash Commands</h1>
      <p className="text-muted-foreground text-center mb-8">
        Discovered {commands.length} slash commands in .claude/commands/
      </p>

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
                {command.metadata?.model && (
                  <div className="mb-2">
                    <h4 className="font-semibold text-sm mb-1 text-muted-foreground">Model:</h4>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                      {command.metadata.model}
                    </span>
                  </div>
                )}
                {command.metadata?.argumentHint && (
                  <div className="mb-2">
                    <h4 className="font-semibold text-sm mb-1 text-muted-foreground">Arguments:</h4>
                    <span className="text-xs text-muted-foreground">
                      {command.metadata.argumentHint}
                    </span>
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
    </div>
  );
};

export default CommandsPage;
