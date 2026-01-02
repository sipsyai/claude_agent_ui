/**
 * Flow Template Selector Component
 *
 * A modal/panel component for browsing and selecting pre-built flow templates.
 * Used when creating a new flow to provide quick-start options.
 */

import React, { useState, useMemo } from 'react';
import type { FlowCategory } from '../../types';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  SearchIcon,
  XCircleIcon,
  CheckCircleIcon,
  PlusIcon,
} from '../ui/Icons';

// =============================================================================
// TEMPLATE DATA (mirrored from backend flow-templates.ts for frontend use)
// =============================================================================

interface FlowTemplate {
  templateId: string;
  name: string;
  description: string;
  category: FlowCategory;
  icon: string;
  tags: string[];
}

// Pre-built templates matching the backend
const flowTemplates: FlowTemplate[] = [
  {
    templateId: 'web-scraper',
    name: 'Web Scraper',
    description: 'Scrape content from websites and extract structured data. Perfect for gathering information from web pages.',
    category: 'web-scraping',
    icon: '🌐',
    tags: ['web', 'scraping', 'extraction', 'content'],
  },
  {
    templateId: 'data-processor',
    name: 'Data Processor',
    description: 'Process, transform, and analyze data using AI. Great for data cleaning, summarization, and format conversion.',
    category: 'data-processing',
    icon: '📊',
    tags: ['data', 'processing', 'transform', 'analyze'],
  },
  {
    templateId: 'api-integration',
    name: 'API Integration',
    description: 'Connect to external APIs, fetch data, and process responses. Ideal for integrating with third-party services.',
    category: 'api-integration',
    icon: '🔌',
    tags: ['api', 'integration', 'rest', 'fetch'],
  },
  {
    templateId: 'content-writer',
    name: 'Content Writer',
    description: 'Generate blog posts, articles, social media content, and more. Perfect for content creation workflows.',
    category: 'automation',
    icon: '✍️',
    tags: ['content', 'writing', 'blog', 'social-media'],
  },
  {
    templateId: 'document-analyzer',
    name: 'Document Analyzer',
    description: 'Analyze documents, extract key information, summarize content, and answer questions about the document.',
    category: 'data-processing',
    icon: '📄',
    tags: ['document', 'analysis', 'extraction', 'summary'],
  },
  {
    templateId: 'code-assistant',
    name: 'Code Assistant',
    description: 'Get help with coding tasks - write, review, explain, or debug code in any programming language.',
    category: 'automation',
    icon: '💻',
    tags: ['code', 'programming', 'development', 'debug'],
  },
  {
    templateId: 'email-responder',
    name: 'Email Responder',
    description: 'Draft professional email responses with the right tone and content. Perfect for customer support and business communication.',
    category: 'automation',
    icon: '📧',
    tags: ['email', 'response', 'communication', 'support'],
  },
  {
    templateId: 'file-processor',
    name: 'File Processor',
    description: 'Process files - convert formats, extract data, merge documents, or generate reports from file content.',
    category: 'file-manipulation',
    icon: '📁',
    tags: ['file', 'processing', 'conversion', 'extract'],
  },
];

// Category metadata
const CATEGORY_INFO: Record<FlowCategory, { label: string; color: string }> = {
  'web-scraping': { label: 'Web Scraping', color: 'bg-blue-100 text-blue-700' },
  'data-processing': { label: 'Data Processing', color: 'bg-green-100 text-green-700' },
  'api-integration': { label: 'API Integration', color: 'bg-purple-100 text-purple-700' },
  'file-manipulation': { label: 'File Manipulation', color: 'bg-yellow-100 text-yellow-700' },
  'automation': { label: 'Automation', color: 'bg-pink-100 text-pink-700' },
  'custom': { label: 'Custom', color: 'bg-gray-100 text-gray-700' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export interface FlowTemplateSelectorProps {
  onSelect: (templateId: string) => void;
  onStartFromScratch: () => void;
  onClose?: () => void;
}

const FlowTemplateSelector: React.FC<FlowTemplateSelectorProps> = ({
  onSelect,
  onStartFromScratch,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FlowCategory | 'all'>('all');
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let templates = flowTemplates;

    // Filter by category
    if (selectedCategory !== 'all') {
      templates = templates.filter((t) => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return templates;
  }, [searchQuery, selectedCategory]);

  // Get unique categories from templates
  const categories = useMemo(() => {
    const cats = new Set(flowTemplates.map((t) => t.category));
    return Array.from(cats);
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Create New Flow</h2>
          <p className="text-muted-foreground">
            Start with a template or create from scratch
          </p>
        </div>
        {onClose && (
          <Button variant="secondary" onClick={onClose}>
            <XCircleIcon className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        )}
      </div>

      {/* Start from Scratch Option */}
      <Card
        className="mb-6 cursor-pointer hover:border-primary transition-colors"
        onClick={onStartFromScratch}
      >
        <CardContent className="flex items-center gap-4 py-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-2xl">
            <PlusIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Start from Scratch</h3>
            <p className="text-sm text-muted-foreground">
              Create a blank flow with custom configuration
            </p>
          </div>
          <CheckCircleIcon className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-sm text-muted-foreground font-medium">
          Or choose a template
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search Input */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {CATEGORY_INFO[cat].label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <Card
              key={template.templateId}
              className={`cursor-pointer transition-all ${
                hoveredTemplate === template.templateId
                  ? 'border-primary shadow-md scale-[1.02]'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => onSelect(template.templateId)}
              onMouseEnter={() => setHoveredTemplate(template.templateId)}
              onMouseLeave={() => setHoveredTemplate(null)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-2xl shrink-0">
                    {template.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{template.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          CATEGORY_INFO[template.category].color
                        }`}
                      >
                        {CATEGORY_INFO[template.category].label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-secondary rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-muted-foreground">
                          +{template.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selection indicator */}
                  <div
                    className={`transition-opacity ${
                      hoveredTemplate === template.templateId
                        ? 'opacity-100'
                        : 'opacity-0'
                    }`}
                  >
                    <CheckCircleIcon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="font-semibold mb-2">No templates found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search or filter criteria
          </p>
          <Button variant="secondary" onClick={() => {
            setSearchQuery('');
            setSelectedCategory('all');
          }}>
            Clear filters
          </Button>
        </div>
      )}

      {/* Template Count */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Showing {filteredTemplates.length} of {flowTemplates.length} templates
      </div>
    </div>
  );
};

export default FlowTemplateSelector;

export type { FlowTemplate };
