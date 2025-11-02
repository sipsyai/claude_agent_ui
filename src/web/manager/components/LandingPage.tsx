import React, { useRef, ChangeEvent, useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { FolderIcon, ArrowRightIcon, ArrowLeftIcon } from './ui/Icons';

interface LandingPageProps {
  onDirectoryChange: (path: string) => void;
  onNext: () => void;
  directorySelected: boolean;
  directoryName?: string;
  onBack: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onDirectoryChange, onNext, directorySelected, directoryName, onBack }) => {
  const [pathInput, setPathInput] = useState(directoryName || '');

  // Automatically trigger onDirectoryChange if directoryName is pre-populated from localStorage
  useEffect(() => {
    if (directoryName && directoryName.trim()) {
      onDirectoryChange(directoryName.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryName]);

  const handlePathChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPathInput(value);
    if (value.trim()) {
      onDirectoryChange(value.trim());
    }
  };

  return (
    <div className="flex flex-col items-center text-center max-w-3xl mx-auto animate-fade-in">
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
        Select Your Project
      </h2>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Enter the full path to your project directory. The tool will automatically scan for Claude Agent configurations.
      </p>

      <div className="mt-10 w-full max-w-2xl space-y-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="path-input" className="text-sm font-medium text-left">
            Project Directory Path
          </label>
          <Input
            id="path-input"
            type="text"
            placeholder="C:/Users/YourName/Documents/Projects/your-project"
            value={pathInput}
            onChange={handlePathChange}
            className="text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground text-left">
            Example: <code className="bg-muted px-1 py-0.5 rounded-sm">C:/Users/Ali/Documents/Projects/claude-agent-sdk-typescript</code>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <Button onClick={onNext} disabled={!directorySelected} size="lg" className="w-full sm:w-auto flex-grow">
            Next
            <ArrowRightIcon className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        We'll look for a <code className="bg-muted px-1 py-0.5 rounded-sm font-mono text-xs">.claude</code> folder inside this directory.
      </p>

      <div className="mt-8">
        <Button onClick={onBack} variant="secondary" size="sm">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default LandingPage;
