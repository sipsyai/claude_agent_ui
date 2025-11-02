
import React from 'react';
import type { ValidationStep } from '../types';
import { CheckCircleIcon, XCircleIcon, SpinnerIcon } from './ui/Icons';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/Card';
import { Button } from './ui/Button';

interface ValidationPageProps {
  steps: ValidationStep[];
  onRetry: () => void;
}

const getStatusIcon = (status: ValidationStep['status']) => {
  switch (status) {
    case 'loading':
      return <SpinnerIcon className="h-6 w-6 text-blue-400" />;
    case 'success':
      return <CheckCircleIcon className="h-6 w-6 text-green-400" />;
    case 'error':
      return <XCircleIcon className="h-6 w-6 text-red-400" />;
    default:
      return <div className="h-6 w-6 rounded-full border-2 border-muted-foreground" />;
  }
};

const ValidationPage: React.FC<ValidationPageProps> = ({ steps, onRetry }) => {
  const allSuccessful = steps.every(step => step.status === 'success');
  const hasError = steps.some(step => step.status === 'error');

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-fade-in">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Validating Project Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {steps.map((step) => (
              <li key={step.id} className="flex flex-col p-3 bg-secondary rounded-lg">
                <div className="flex items-center space-x-4">
                  <div>{getStatusIcon(step.status)}</div>
                  <span className={`flex-1 ${step.status === 'pending' ? 'text-muted-foreground' : ''}`}>
                    {step.label}
                  </span>
                </div>
                {step.status === 'error' && step.error && (
                  <p className="mt-2 text-sm text-red-400 pl-10">{step.error}</p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex-col pt-4">
          {allSuccessful && (
            <div className="text-center text-green-400 font-medium flex items-center justify-center">
              <CheckCircleIcon className="h-5 w-5 mr-2"/>
              Validation successful! Loading agents...
            </div>
          )}
          {hasError && (
              <div className="text-center flex flex-col items-center gap-4">
                <p className="text-red-400">Validation failed. Please resolve the issues and try again.</p>
                <Button onClick={onRetry}>Retry Validation</Button>
              </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default ValidationPage;
