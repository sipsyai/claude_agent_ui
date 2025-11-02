import React from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { ShieldCheckIcon, CogIcon, PlayCircleIcon, ArrowRightIcon } from './ui/Icons';

interface HomePageProps {
  onGetStarted: () => void;
}

const features = [
  {
    icon: <ShieldCheckIcon className="h-8 w-8 text-primary" />,
    title: 'Validate Setup',
    description: 'Automatically check for the Claude Code CLI, SDK, and correct project folder structure.',
  },
  {
    icon: <CogIcon className="h-8 w-8 text-primary" />,
    title: 'Configure Agents',
    description: 'Dynamically generates forms based on your agent definitions for easy configuration.',
  },
  {
    icon: <PlayCircleIcon className="h-8 w-8 text-primary" />,
    title: 'Run & Monitor',
    description: 'Execute your agents directly from the browser and get immediate feedback on their status.',
  },
];

const HomePage: React.FC<HomePageProps> = ({ onGetStarted }) => {
  return (
    <div className="flex flex-col items-center text-center max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-200 to-gray-500">
        Claude Agent Manager
      </h1>
      <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-3xl">
        The all-in-one solution to validate, configure, and run your Claude Agents locally. Streamline your development workflow and manage your agents with ease.
      </p>
      <div className="mt-10">
        <Button onClick={onGetStarted} size="lg">
          Get Started
          <ArrowRightIcon className="h-5 w-5 ml-2" />
        </Button>
      </div>

      <div className="mt-20 w-full">
        <h2 className="text-3xl font-bold tracking-tight text-center">Features</h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-secondary/50 border-secondary hover:border-primary/50 transition-colors">
              <CardHeader className="items-center">
                {feature.icon}
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
