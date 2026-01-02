/**
 * @file HomePage.tsx
 * @description Landing page component that serves as the entry point for the Claude Agent Manager setup workflow.
 * Displays the application's welcome message, value proposition, and feature highlights to introduce users
 * to the platform's capabilities before guiding them through the setup process.
 *
 * ## Features
 * - **Hero Section**: Eye-catching title with gradient text effect and tagline describing the platform
 * - **Call-to-Action**: Prominent "Get Started" button to initiate the setup workflow
 * - **Feature Showcase**: Three-column grid highlighting key platform capabilities
 * - **Responsive Design**: Mobile-first layout with breakpoints for tablet and desktop views
 * - **Animated Entry**: Fade-in animation on component mount for polished user experience
 * - **Visual Hierarchy**: Clear typography scale and spacing for content organization
 *
 * ## Layout Structure
 * The HomePage uses a centered column layout with distinct sections:
 *
 * ### 1. Hero Section
 * - **Title**: "Claude Agent Manager" with gradient text (gray-200 to gray-500)
 * - **Typography**: 4xl on mobile, 5xl on tablet, 6xl on desktop
 * - **Font Weight**: Extrabold (800) with tight tracking for impact
 * - **Gradient Effect**: bg-clip-text technique for modern visual appeal
 *
 * ### 2. Tagline Section
 * - **Content**: Platform description emphasizing validation, configuration, and execution capabilities
 * - **Typography**: lg on mobile (18px), xl on tablet (20px)
 * - **Color**: text-muted-foreground for subtle contrast
 * - **Max Width**: 3xl (48rem) for optimal reading line length
 * - **Spacing**: mt-4 (16px) gap from title
 *
 * ### 3. Call-to-Action Section
 * - **Button**: Large size Button component with ArrowRightIcon
 * - **Callback**: onGetStarted prop invoked on click to advance to landing page
 * - **Spacing**: mt-10 (40px) gap from tagline for emphasis
 * - **Icon**: ArrowRightIcon (5x5) positioned to the right of text with ml-2 spacing
 *
 * ### 4. Features Section
 * - **Heading**: "Features" with 3xl font size and bold weight
 * - **Grid Layout**: 1 column on mobile, 3 columns on md+ (768px breakpoint)
 * - **Gap**: 8 units (32px) between feature cards
 * - **Spacing**: mt-20 (80px) gap from CTA for clear section separation
 * - **Card Style**: Semi-transparent secondary background with hover border effect
 *
 * ## Feature Cards
 * Three feature cards showcase the platform's core capabilities:
 *
 * ### 1. Validate Setup (ShieldCheckIcon)
 * - **Title**: "Validate Setup"
 * - **Icon**: Shield with checkmark in primary color
 * - **Description**: Automated checks for Claude Code CLI, SDK, and project structure
 * - **Purpose**: Communicates the platform's validation capabilities
 *
 * ### 2. Configure Agents (CogIcon)
 * - **Title**: "Configure Agents"
 * - **Icon**: Cog/settings icon in primary color
 * - **Description**: Dynamic form generation based on agent definitions
 * - **Purpose**: Highlights the configuration interface and ease of use
 *
 * ### 3. Run & Monitor (PlayCircleIcon)
 * - **Title**: "Run & Monitor"
 * - **Icon**: Play circle icon in primary color
 * - **Description**: Browser-based agent execution with real-time feedback
 * - **Purpose**: Emphasizes the execution and monitoring functionality
 *
 * ## Navigation Flow
 * The HomePage is the first step in the setup workflow:
 *
 * 1. **User lands on HomePage** (setupStep='home' in ManagerApp)
 * 2. **User clicks "Get Started"** button
 * 3. **onGetStarted callback** invoked by HomePage
 * 4. **ManagerApp transitions** to landing page (setupStep='landing')
 * 5. **LandingPage displays** directory selection interface
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS classes for styling:
 *
 * - **Container**: flex flex-col items-center text-center max-w-4xl mx-auto
 * - **Animation**: animate-fade-in class for smooth entrance (defined in global CSS)
 * - **Title Gradient**: bg-gradient-to-br from-gray-200 to-gray-500 with bg-clip-text
 * - **Card Hover**: border-primary/50 transition on hover for interactive feedback
 * - **Responsive Typography**: text-4xl sm:text-5xl lg:text-6xl for title scaling
 * - **Responsive Grid**: grid-cols-1 md:grid-cols-3 for feature cards
 * - **Icon Size**: h-8 w-8 (32px) for feature icons, h-5 w-5 (20px) for button icon
 * - **Color Scheme**: Uses theme colors (primary, secondary, muted-foreground) for consistency
 *
 * @example
 * // Basic usage in ManagerApp setup phase
 * import HomePage from './components/HomePage';
 *
 * function ManagerApp() {
 *   const [setupStep, setSetupStep] = useState<SetupStep>('home');
 *
 *   const handleGetStarted = () => {
 *     setSetupStep('landing');
 *   };
 *
 *   if (setupStep === 'home') {
 *     return <HomePage onGetStarted={handleGetStarted} />;
 *   }
 *
 *   // ... render other setup steps
 * }
 *
 * @example
 * // Understanding the complete setup flow
 * // HomePage is the entry point for new users:
 *
 * // Step 1: User sees HomePage with welcome message
 * <HomePage onGetStarted={() => console.log('Starting setup...')} />
 *
 * // Step 2: User clicks "Get Started" button
 * // - onClick event fires on Button component
 * // - onGetStarted callback is invoked
 * // - Parent component (ManagerApp) transitions to landing page
 *
 * // Step 3: LandingPage displays with directory selection
 * // Step 4: ValidationPage runs project validation
 * // Step 5: DashboardPage displays main interface
 *
 * @example
 * // Custom styling with container wrapper
 * import HomePage from './components/HomePage';
 *
 * function SetupWizard() {
 *   const handleStart = () => {
 *     console.log('User initiated setup workflow');
 *     // Navigate to next step, track analytics, etc.
 *   };
 *
 *   return (
 *     <div className="min-h-screen bg-background flex items-center justify-center p-6">
 *       <HomePage onGetStarted={handleStart} />
 *     </div>
 *   );
 * }
 *
 * @example
 * // Understanding feature card structure
 * // Each feature card has consistent structure:
 * const featureExample = {
 *   icon: <ShieldCheckIcon className="h-8 w-8 text-primary" />,  // Icon component
 *   title: 'Validate Setup',                                      // Feature name
 *   description: 'Automatically check for the Claude Code...',    // Feature description
 * };
 *
 * // Rendered as:
 * <Card className="bg-secondary/50 border-secondary hover:border-primary/50">
 *   <CardHeader className="items-center">
 *     {featureExample.icon}
 *     <CardTitle>{featureExample.title}</CardTitle>
 *   </CardHeader>
 *   <CardContent>
 *     <p className="text-muted-foreground text-sm">{featureExample.description}</p>
 *   </CardContent>
 * </Card>
 */

import React from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { ShieldCheckIcon, CogIcon, PlayCircleIcon, ArrowRightIcon } from './ui/Icons';

/**
 * Props for the HomePage component
 *
 * @interface HomePageProps
 * @property {() => void} onGetStarted - Callback function invoked when user clicks the "Get Started" button.
 *                                        Should transition to the next step in the setup workflow (landing page).
 *                                        Typically handled by ManagerApp to update setupStep state.
 */
interface HomePageProps {
  onGetStarted: () => void;
}

/**
 * Feature card data structure
 *
 * Static array of three features displayed in the Features section.
 * Each feature has an icon, title, and description to communicate
 * the platform's core capabilities to new users.
 *
 * @internal
 */
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

/**
 * HomePage component - Entry point for the Claude Agent Manager setup workflow
 *
 * Displays a welcoming landing page with the application title, tagline, call-to-action button,
 * and feature highlights. This is the first page users see when starting the setup process.
 *
 * @param {HomePageProps} props - Component props
 * @returns {JSX.Element} Rendered HomePage component
 */
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

HomePage.displayName = 'HomePage';

export default HomePage;
