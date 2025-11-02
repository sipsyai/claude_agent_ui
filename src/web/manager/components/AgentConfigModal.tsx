
import React, { useState, useCallback, useMemo } from 'react';
import type { Agent, AgentInput } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Select } from './ui/Select';
import { SpinnerIcon, CheckCircleIcon, XCircleIcon } from './ui/Icons';

interface AgentConfigModalProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
}

type ExecutionStatus = 'idle' | 'loading' | 'success' | 'error';

const AgentConfigModal: React.FC<AgentConfigModalProps> = ({ agent, isOpen, onClose }) => {
  const initialFormState = useMemo(() => 
    agent.inputs.reduce((acc, input) => {
      acc[input.name] = input.defaultValue ?? '';
      return acc;
    }, {} as Record<string, any>), 
  [agent.inputs]);
  
  const [formState, setFormState] = useState<Record<string, any>>(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle');
  const [executionResult, setExecutionResult] = useState<string>('');

  const handleInputChange = (name: string, value: string | File) => {
    setFormState(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const renderInput = (input: AgentInput) => {
    const value = formState[input.name];
    const error = errors[input.name];

    const label = (
      <label htmlFor={input.name} className="block text-sm font-medium text-muted-foreground mb-1">
        {input.description}
        {input.required && <span className="text-red-400 ml-1">*</span>}
      </label>
    );

    switch (input.type) {
      case 'textarea':
        return (
          <div key={input.name}>
            {label}
            <Textarea
              id={input.name}
              value={value}
              onChange={(e) => handleInputChange(input.name, e.target.value)}
              placeholder={`Enter ${input.name}...`}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      case 'select':
        return (
          <div key={input.name}>
            {label}
            <Select
              id={input.name}
              value={value}
              onChange={(e) => handleInputChange(input.name, e.target.value)}
              className={error ? 'border-red-500' : ''}
            >
              {input.options?.map(option => <option key={option} value={option}>{option}</option>)}
            </Select>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      case 'file':
        return (
          <div key={input.name}>
            {label}
            <Input
              id={input.name}
              type="file"
              onChange={(e) => handleInputChange(input.name, e.target.files?.[0] || '')}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      case 'number':
         return (
          <div key={input.name}>
            {label}
            <Input
              id={input.name}
              type="number"
              value={value}
              onChange={(e) => handleInputChange(input.name, e.target.value)}
              placeholder={`Enter ${input.name}...`}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      case 'text':
      default:
        return (
          <div key={input.name}>
            {label}
            <Input
              id={input.name}
              type="text"
              value={value}
              onChange={(e) => handleInputChange(input.name, e.target.value)}
              placeholder={`Enter ${input.name}...`}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
    }
  };
  
  const handleRunAgent = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    agent.inputs.forEach(input => {
      if (input.required && !formState[input.name]) {
        newErrors[input.name] = `${input.name} is required.`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setExecutionStatus('loading');
    setExecutionResult('');
    await new Promise(res => setTimeout(res, 2000)); // Simulate API call

    // Simulate success/error
    if (Math.random() > 0.15) {
      setExecutionStatus('success');
      setExecutionResult(`Agent "${agent.name}" ran successfully. Output has been generated.`);
    } else {
      setExecutionStatus('error');
      setExecutionResult(`Agent "${agent.name}" failed to run. Please check the logs.`);
    }
  }, [agent, formState]);

  const handleClose = () => {
    setFormState(initialFormState);
    setErrors({});
    setExecutionStatus('idle');
    setExecutionResult('');
    onClose();
  };

  const renderResult = () => {
    if (executionStatus === 'idle') return null;

    const baseClasses = "mt-4 p-4 rounded-md text-sm flex items-start space-x-3";
    
    if (executionStatus === 'success') {
      return (
        <div className={`${baseClasses} bg-green-900/50 text-green-300`}>
          <CheckCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p>{executionResult}</p>
        </div>
      );
    }

    if (executionStatus === 'error') {
      return (
        <div className={`${baseClasses} bg-red-900/50 text-red-300`}>
          <XCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p>{executionResult}</p>
        </div>
      );
    }
    
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>{agent.name}</DialogTitle>
          <DialogDescription>{agent.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-3">
          {agent.inputs.map(renderInput)}
        </div>
        {renderResult()}
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleRunAgent} disabled={executionStatus === 'loading'}>
            {executionStatus === 'loading' && <SpinnerIcon className="h-4 w-4 mr-2" />}
            Run Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgentConfigModal;
   